-- REVIEW REQUIRED. Data-preserving additions and access restrictions; no resets,
-- deletes, historical settlement replay, or balance backfills. Requires 039.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expected_minor BIGINT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_rate NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS net_amount NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS asset_snapshot JSONB;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS agreement_snapshot JSONB;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS splits_snapshot JSONB;
ALTER TABLE public.beats ADD COLUMN IF NOT EXISTS exclusive_order_id UUID REFERENCES public.orders(id);
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_item_recipient ON public.ledger_transactions(order_item_id, producer_id, type) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS order_items_created_at ON public.order_items(created_at);
ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS transfer_payload JSONB;

CREATE TABLE IF NOT EXISTS public.promo_reservations (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id),
  promo_id UUID NOT NULL REFERENCES public.promo_codes(id),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS public.delivery_jobs (
  order_item_id UUID PRIMARY KEY REFERENCES public.order_items(id),
  attempts INT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  reference TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users_profiles(id),
  tier TEXT NOT NULL CHECK (tier IN ('STARTER', 'PRO')),
  expected_minor BIGINT NOT NULL CHECK (expected_minor > 0),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.request_limits (
  key TEXT PRIMARY KEY, hits INT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  reference TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_reconciliations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_reconciliations TO service_role;
ALTER TABLE public.promo_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_reservations, public.delivery_jobs, public.subscription_payments, public.request_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.promo_reservations, public.delivery_jobs, public.subscription_payments, public.request_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_request_limit(p_key TEXT, p_limit INT, p_seconds INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_hits INT;
BEGIN
  IF p_limit < 1 OR p_seconds < 1 OR length(p_key) > 200 THEN RAISE EXCEPTION 'Invalid rate limit'; END IF;
  INSERT INTO public.request_limits AS r VALUES (p_key, 1, now() + make_interval(secs => p_seconds))
  ON CONFLICT (key) DO UPDATE SET hits = CASE WHEN r.expires_at <= now() THEN 1 ELSE r.hits + 1 END,
    expires_at = CASE WHEN r.expires_at <= now() THEN EXCLUDED.expires_at ELSE r.expires_at END
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_limit;
END; $$;

CREATE OR REPLACE FUNCTION public.active_tier(p_user UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE((SELECT CASE WHEN subscription_active IS NOT FALSE
    AND subscription_expires_at > now() AND subscription_tier IN ('STARTER','PRO')
    THEN subscription_tier ELSE 'FREE' END FROM public.producer_settings WHERE user_id = p_user), 'FREE');
$$;

CREATE OR REPLACE FUNCTION public.prepare_checkout(p_buyer UUID, p_items JSONB, p_reference TEXT,
  p_rate NUMERIC, p_defaults JSONB, p_promo TEXT DEFAULT NULL, p_offer UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_order UUID := gen_random_uuid(); v_item JSONB; v_beat public.beats%ROWTYPE;
  v_promo public.promo_codes%ROWTYPE; v_offer public.offers%ROWTYPE;
  v_subtotal NUMERIC := 0; v_eligible NUMERIC := 0; v_discount NUMERIC := 0;
  v_price NUMERIC; v_net NUMERIC; v_type TEXT; v_template JSONB; v_contract TEXT;
  v_producer TEXT; v_buyer TEXT; v_fee NUMERIC; v_collab NUMERIC; v_splits JSONB;
  v_count INT; v_minor BIGINT; v_item_id UUID; v_snapshot JSONB;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
    OR p_rate IS NULL OR p_rate <= 0 OR p_rate::TEXT IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid checkout'; END IF;
  IF (SELECT count(DISTINCT value->>'beat_id') FROM jsonb_array_elements(p_items)) <> jsonb_array_length(p_items)
    THEN RAISE EXCEPTION 'Duplicate beats in cart'; END IF;
  IF p_offer IS NOT NULL THEN
    SELECT * INTO v_offer FROM public.offers WHERE id = p_offer FOR UPDATE;
    IF NOT FOUND OR v_offer.buyer_id <> p_buyer OR v_offer.status <> 'ACCEPTED' OR v_offer.expires_at <= now()
      OR v_offer.expires_at IS NULL OR jsonb_array_length(p_items) <> 1 OR p_promo IS NOT NULL THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE offer_id=p_offer AND (status='completed' OR (status='pending' AND created_at>now()-interval '30 minutes'))) THEN RAISE EXCEPTION 'Offer already paid or checkout in progress'; END IF;
  END IF;
  -- Match settlement's offer -> promotion -> beat lock order.
  IF p_promo IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes WHERE code=upper(regexp_replace(p_promo,'\s','','g')) FOR UPDATE;
  END IF;
  -- Stable lock order serializes checkout with edits and exclusive reservation.
  PERFORM 1 FROM public.beats WHERE id IN (SELECT (value->>'beat_id')::UUID FROM jsonb_array_elements(p_items)) ORDER BY id FOR UPDATE;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_beat FROM public.beats WHERE id=(v_item->>'beat_id')::UUID;
    IF NOT FOUND OR v_beat.status <> 'active' OR v_beat.is_exclusive_sold THEN RAISE EXCEPTION 'Beat unavailable'; END IF;
    v_type := v_item->>'license_type';
    IF EXISTS(SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.buyer_id=p_buyer AND o.status='completed' AND i.beat_id=v_beat.id AND i.license_type=v_type) THEN RAISE EXCEPTION 'License already owned'; END IF;
    v_price := CASE v_type WHEN 'mp3' THEN v_beat.price_mp3 WHEN 'wav' THEN v_beat.price_wav WHEN 'trackout' THEN v_beat.price_trackout WHEN 'exclusive' THEN v_beat.price_exclusive END;
    IF v_type='trackout' AND v_beat.file_stems_url IS NULL THEN RAISE EXCEPTION 'Stems unavailable'; END IF;
    IF p_offer IS NOT NULL THEN
      IF v_offer.beat_id <> v_beat.id OR v_offer.producer_id <> v_beat.producer_id OR v_offer.license_type <> v_type THEN RAISE EXCEPTION 'Offer mismatch'; END IF;
      v_price := v_offer.amount;
    END IF;
    IF v_price IS NULL OR v_price <= 0 OR v_price::TEXT IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid license price'; END IF;
    v_subtotal := v_subtotal + v_price;
  END LOOP;
  IF p_promo IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes WHERE code=upper(regexp_replace(p_promo,'\s','','g')) FOR UPDATE;
    IF NOT FOUND OR NOT v_promo.is_active OR v_promo.expires_at <= now() OR v_subtotal < v_promo.min_order_amount THEN RAISE EXCEPTION 'Promo unavailable'; END IF;
    SELECT count(*) INTO v_count FROM public.promo_reservations r JOIN public.orders o ON o.id=r.order_id
      WHERE r.promo_id=v_promo.id AND r.expires_at > now() AND o.status='pending';
    IF v_promo.max_uses IS NOT NULL AND COALESCE(v_promo.uses_count,0)+v_count >= v_promo.max_uses THEN RAISE EXCEPTION 'Promo exhausted'; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
      SELECT * INTO v_beat FROM public.beats WHERE id=(v_item->>'beat_id')::UUID;
      IF v_promo.producer_id IS NULL OR v_promo.producer_id=v_beat.producer_id THEN
        v_eligible := v_eligible + CASE v_item->>'license_type' WHEN 'mp3' THEN v_beat.price_mp3 WHEN 'wav' THEN v_beat.price_wav WHEN 'trackout' THEN v_beat.price_trackout WHEN 'exclusive' THEN v_beat.price_exclusive END;
      END IF;
    END LOOP;
    IF v_eligible <= 0 THEN RAISE EXCEPTION 'Promo does not apply to this cart'; END IF;
    v_discount := round(least(v_eligible, greatest(0, CASE v_promo.discount_type WHEN 'percentage' THEN v_eligible*v_promo.discount_value/100 ELSE v_promo.discount_value END)),2);
  END IF;
  v_minor := round((v_subtotal-v_discount)*p_rate*100);
  INSERT INTO public.orders(id,buyer_id,total_amount,status,gateway,gateway_reference,promo_code_id,discount_amount,expected_minor,checkout_rate,offer_id)
    VALUES(v_order,p_buyer,v_subtotal-v_discount,'pending','paystack',p_reference,v_promo.id,v_discount,v_minor,p_rate,p_offer);
  IF v_promo.id IS NOT NULL THEN INSERT INTO public.promo_reservations VALUES(v_order,v_promo.id,now()+interval '30 minutes'); END IF;
  SELECT COALESCE(display_name,handle,'Customer') INTO v_buyer FROM public.users_profiles WHERE id=p_buyer;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_beat FROM public.beats WHERE id=(v_item->>'beat_id')::UUID;
    v_type := v_item->>'license_type';
    v_price := CASE v_type WHEN 'mp3' THEN v_beat.price_mp3 WHEN 'wav' THEN v_beat.price_wav WHEN 'trackout' THEN v_beat.price_trackout WHEN 'exclusive' THEN v_beat.price_exclusive END;
    IF p_offer IS NOT NULL THEN v_price := v_offer.amount; END IF;
    v_net := v_price;
    IF v_promo.id IS NOT NULL AND (v_promo.producer_id IS NULL OR v_promo.producer_id=v_beat.producer_id) THEN v_net := v_price*(1-v_discount/v_eligible); END IF;
    IF v_type='exclusive' THEN
      IF v_beat.exclusive_reserved_until > now() THEN RAISE EXCEPTION 'Exclusive is reserved'; END IF;
      UPDATE public.beats SET exclusive_order_id=v_order,exclusive_reserved_until=now()+interval '30 minutes' WHERE id=v_beat.id;
    END IF;
    SELECT COALESCE(sum(split_percentage),0) INTO v_collab FROM public.beat_collaborators WHERE beat_id=v_beat.id;
    IF v_collab>100 THEN RAISE EXCEPTION 'Invalid collaborator allocation'; END IF;
    v_fee := CASE public.active_tier(v_beat.producer_id) WHEN 'PRO' THEN 0 WHEN 'STARTER' THEN .1 ELSE .2 END;
    SELECT jsonb_agg(jsonb_build_object('producer_id',recipient,'percentage',share,'fee',v_fee)) INTO v_splits FROM (
      SELECT recipient,sum(share) AS share FROM (
        SELECT v_beat.producer_id AS recipient,100-v_collab AS share
        UNION ALL SELECT collaborator_id,split_percentage FROM public.beat_collaborators WHERE beat_id=v_beat.id
      ) s GROUP BY recipient HAVING sum(share)>0
    ) s;
    SELECT to_jsonb(t) INTO v_template FROM public.license_templates t WHERE producer_id=v_beat.producer_id
      AND type=CASE v_type WHEN 'mp3' THEN 'basic' WHEN 'wav' THEN 'premium' WHEN 'trackout' THEN 'unlimited' ELSE 'exclusive' END AND is_active;
    v_template := COALESCE(v_template,p_defaults->v_type);
    IF v_template->>'contract_text' IS NULL THEN RAISE EXCEPTION 'Missing license template'; END IF;
    SELECT COALESCE(display_name,handle,'Producer') INTO v_producer FROM public.users_profiles WHERE id=v_beat.producer_id;
    v_contract := v_template->>'contract_text';
    v_contract := replace(replace(replace(replace(replace(replace(replace(v_contract,
      '{{PRODUCER_NAME}}',v_producer),'{{BUYER_NAME}}',v_buyer),'{{TRACK_TITLE}}',v_beat.title),
      '{{STREAM_LIMIT}}',CASE WHEN (v_template->>'streaming_limit')::BIGINT=0 THEN 'Unlimited' ELSE COALESCE(v_template->>'streaming_limit','50000') END),
      '{{MV_LIMIT}}',CASE WHEN (v_template->>'music_video_limit')::INT=0 THEN 'Unlimited' ELSE COALESCE(v_template->>'music_video_limit','1') END),
      '{{RADIO_RIGHTS}}',CASE WHEN (v_template->>'radio_broadcasting')::BOOLEAN THEN 'Radio Rights Included' ELSE 'No Radio Rights' END),
      '{{DATE}}',to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD'));
    v_snapshot := jsonb_build_object('legal_text',v_contract || E'\nOrder: ' || v_order::TEXT,'buyer_name',v_buyer,'producer_name',v_producer,'track_title',v_beat.title);
    INSERT INTO public.order_items(order_id,beat_id,producer_id,license_type,price,net_amount,asset_snapshot,agreement_snapshot,splits_snapshot)
      VALUES(v_order,v_beat.id,v_beat.producer_id,v_type,v_price,v_net,
        jsonb_build_object('mp3',v_beat.file_mp3_url,'wav',v_beat.file_wav_url,'stems',v_beat.file_stems_url),v_snapshot,v_splits)
      RETURNING id INTO v_item_id;
  END LOOP;
  RETURN jsonb_build_object('order_id',v_order,'expected_minor',v_minor,'total_amount',v_subtotal-v_discount);
END; $$;

CREATE OR REPLACE FUNCTION public.settle_order(p_order UUID,p_reference TEXT,p_amount BIGINT,p_currency TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.orders%ROWTYPE; i public.order_items%ROWTYPE; s JSONB; amount NUMERIC; b public.beats%ROWTYPE; p public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id=p_order FOR UPDATE;
  IF NOT FOUND OR o.gateway_reference<>p_reference THEN RAISE EXCEPTION 'Order reference mismatch'; END IF;
  IF o.status='completed' THEN RETURN o.id; END IF;
  IF o.expected_minor IS NULL OR o.expected_minor<>p_amount OR p_currency<>'GHS' THEN RAISE EXCEPTION 'Payment amount/currency requires reconciliation'; END IF;
  IF o.status<>'pending' THEN RAISE EXCEPTION 'Order requires reconciliation'; END IF;
  IF o.offer_id IS NOT NULL THEN
    PERFORM 1 FROM public.offers WHERE id=o.offer_id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.orders WHERE offer_id=o.offer_id AND status='completed') THEN RAISE EXCEPTION 'Offer already paid; reconcile payment'; END IF;
  END IF;
  IF o.promo_code_id IS NOT NULL THEN
    SELECT * INTO p FROM public.promo_codes WHERE id=o.promo_code_id FOR UPDATE;
    IF p.max_uses IS NOT NULL AND COALESCE(p.uses_count,0)>=p.max_uses THEN RAISE EXCEPTION 'Late promo payment requires reconciliation'; END IF;
    UPDATE public.promo_codes SET uses_count=COALESCE(uses_count,0)+1 WHERE id=p.id;
  END IF;
  PERFORM 1 FROM public.beats WHERE id IN(SELECT beat_id FROM public.order_items WHERE order_id=o.id) ORDER BY id FOR UPDATE;
  FOR i IN SELECT * FROM public.order_items WHERE order_id=o.id ORDER BY beat_id LOOP
    IF i.agreement_snapshot IS NULL OR i.splits_snapshot IS NULL THEN RAISE EXCEPTION 'Missing checkout snapshot'; END IF;
    SELECT * INTO b FROM public.beats WHERE id=i.beat_id;
    IF b.is_exclusive_sold THEN RAISE EXCEPTION 'Beat sold; reconcile payment'; END IF;
    IF i.license_type='exclusive' THEN
      IF b.exclusive_order_id IS DISTINCT FROM o.id THEN RAISE EXCEPTION 'Late exclusive payment requires reconciliation'; END IF;
      UPDATE public.beats SET is_exclusive_sold=true,status='hidden',exclusive_reserved_until=NULL WHERE id=b.id;
    END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(i.splits_snapshot) LOOP
      -- Truncate each share so fractional cents can never over-allocate money.
      amount := trunc(i.net_amount*o.checkout_rate*(1-(s->>'fee')::NUMERIC)*(s->>'percentage')::NUMERIC/100,2);
      IF amount>0 THEN
        INSERT INTO public.ledger_transactions(producer_id,amount,type,status,reference_id,order_item_id,description)
          VALUES((s->>'producer_id')::UUID,amount,'SALE','PENDING',p_reference,i.id,'Beat license sale');
        PERFORM public.credit_pending_balance((s->>'producer_id')::UUID,amount);
      END IF;
    END LOOP;
    INSERT INTO public.order_item_licenses(order_item_id,buyer_id,producer_id,beat_id,license_type,final_legal_text)
      VALUES(i.id,o.buyer_id,i.producer_id,i.beat_id,i.license_type,i.agreement_snapshot->>'legal_text');
    INSERT INTO public.delivery_jobs(order_item_id) VALUES(i.id) ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications(user_id,type,title,body,link)
      VALUES(i.producer_id,'new_sale','New Sale',i.agreement_snapshot->>'track_title','/dashboard/sales');
  END LOOP;
  UPDATE public.orders SET status='completed',updated_at=now() WHERE id=o.id;
  IF o.offer_id IS NOT NULL THEN UPDATE public.offers SET status='PAID' WHERE id=o.offer_id; END IF;
  RETURN o.id;
END; $$;

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS last_actor_id UUID REFERENCES public.users_profiles(id);
CREATE OR REPLACE FUNCTION public.transition_offer(p_offer UUID,p_user UUID,p_status TEXT,p_amount NUMERIC,p_message TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o public.offers%ROWTYPE; producer BOOLEAN;
BEGIN
  SELECT * INTO o FROM public.offers WHERE id=p_offer FOR UPDATE;
  IF NOT FOUND OR p_user NOT IN (o.buyer_id,o.producer_id) OR o.status NOT IN ('PENDING','COUNTERED') THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
  producer:=p_user=o.producer_id;
  IF NOT producer AND (o.status<>'COUNTERED' OR o.last_actor_id IS NOT DISTINCT FROM p_user) THEN RAISE EXCEPTION 'Wait for producer response'; END IF;
  IF producer AND o.status='COUNTERED' AND o.last_actor_id=p_user THEN RAISE EXCEPTION 'Wait for buyer response'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('ACCEPTED','DECLINED','COUNTERED') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF p_status='COUNTERED' AND (p_amount IS NULL OR p_amount<=0 OR p_amount>1000000 OR p_amount::TEXT IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.offers SET status=p_status, amount=CASE WHEN p_status='COUNTERED' THEN round(p_amount,2) ELSE amount END,
    message=COALESCE(left(p_message,2000),message),last_actor_id=p_user,updated_at=now(),
    expires_at=CASE WHEN p_status='ACCEPTED' THEN now()+interval '48 hours' ELSE expires_at END,
    checkout_url=CASE WHEN p_status='ACCEPTED' THEN '/checkout?offer_id='||id ELSE checkout_url END
    WHERE id=p_offer RETURNING * INTO o;
  INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(CASE WHEN producer THEN o.buyer_id ELSE o.producer_id END,'offer_update','Offer updated',p_status,'/dashboard/offers');
  RETURN to_jsonb(o);
END; $$;

CREATE OR REPLACE FUNCTION public.activate_subscription(p_reference TEXT,p_amount BIGINT,p_currency TEXT,p_paid_at TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p public.subscription_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.subscription_payments WHERE reference=p_reference FOR UPDATE;
  IF NOT FOUND OR p.expected_minor<>p_amount OR p_currency<>'GHS' OR p_paid_at IS NULL OR p_paid_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Subscription payment mismatch'; END IF;
  IF p.activated_at IS NOT NULL THEN RETURN false; END IF;
  PERFORM 1 FROM public.producer_settings WHERE user_id=p.user_id FOR UPDATE;
  UPDATE public.subscription_payments SET activated_at=p_paid_at,expires_at=p_paid_at+interval '1 year' WHERE reference=p_reference;
  -- An old payment must never overwrite a newer paid period.
  UPDATE public.producer_settings SET subscription_tier=p.tier,subscription_active=true,
    subscription_expires_at=p_paid_at+interval '1 year',subscription_reference=p_reference
    WHERE user_id=p.user_id AND (subscription_expires_at IS NULL OR subscription_expires_at<p_paid_at+interval '1 year');
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.begin_payout(p_producer UUID,p_amount NUMERIC,p_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM 1 FROM public.wallets WHERE producer_id=p_producer FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.payouts WHERE producer_id=p_producer AND status='PROCESSING') THEN RETURN NULL; END IF;
  IF p_amount<50 OR p_amount IS NULL THEN RAISE EXCEPTION 'Payout below threshold'; END IF;
  PERFORM public.deduct_available_balance(p_producer,p_amount);
  INSERT INTO public.payouts(producer_id,amount,currency,status,reference,transfer_payload)
    VALUES(p_producer,p_amount,'GHS','PROCESSING',p_payload->>'reference',p_payload) RETURNING id INTO v_id;
  INSERT INTO public.ledger_transactions(producer_id,amount,type,status,reference_id,description)
    VALUES(p_producer,-p_amount,'PAYOUT','AVAILABLE',p_payload->>'reference','Payout reserved');
  UPDATE public.wallets SET last_payout_at=now() WHERE producer_id=p_producer;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.eligible_payout_wallets()
RETURNS SETOF public.wallets LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT w.* FROM public.wallets w WHERE w.available_balance>=50
    AND NOT EXISTS(SELECT 1 FROM public.payouts p WHERE p.producer_id=w.producer_id AND p.status='PROCESSING')
    AND (CASE WHEN w.bank_details->>'default_payout'='mobile_money' THEN w.mobile_money_recipient_code ELSE w.recipient_code END) IS NOT NULL
    AND (CASE WHEN w.bank_details->>'default_payout'='mobile_money' THEN w.bank_details->'mobile_money'->>'country'
      ELSE COALESCE(w.bank_details->'bank'->>'country',w.bank_details->>'country') END)='Ghana'
  ORDER BY w.last_payout_at NULLS FIRST,w.producer_id LIMIT 5;
$$;

CREATE OR REPLACE FUNCTION public.sales_chart()
RETURNS TABLE(beat_id UUID,sales BIGINT,revenue NUMERIC)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT i.beat_id,count(*),sum(COALESCE(i.net_amount,i.price))
  FROM public.order_items i JOIN public.orders o ON o.id=i.order_id JOIN public.beats b ON b.id=i.beat_id
  WHERE o.status='completed' AND i.created_at>=now()-interval '30 days' AND b.status='active'
  GROUP BY i.beat_id ORDER BY count(*) DESC LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.finish_payout(p_reference TEXT,p_status TEXT,p_code TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p public.payouts%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.payouts WHERE reference=p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_status IN ('failed','reversed') AND p.status<>'FAILED' AND (p.status='PROCESSING' OR p_status='reversed') THEN
    PERFORM public.restore_available_balance(p.producer_id,p.amount);
    INSERT INTO public.ledger_transactions(producer_id,amount,type,status,reference_id,description)
      VALUES(p.producer_id,p.amount,'ADJUSTMENT','AVAILABLE',p.reference,'Payout returned');
    UPDATE public.payouts SET status='FAILED',updated_at=now() WHERE id=p.id;
  ELSIF p_status='success' AND p.status='PROCESSING' THEN
    UPDATE public.payouts SET status='SUCCESS',updated_at=now(),paystack_transfer_code=COALESCE(p_code,paystack_transfer_code) WHERE id=p.id;
  ELSIF p_code IS NOT NULL AND p.status='PROCESSING' THEN
    UPDATE public.payouts SET paystack_transfer_code=p_code,updated_at=now() WHERE id=p.id;
  END IF;
  RETURN true;
END; $$;

ALTER TABLE public.watermark_jobs ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION public.claim_watermark_job(p_beat UUID DEFAULT NULL)
RETURNS SETOF public.watermark_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RETURN QUERY UPDATE public.watermark_jobs SET status='processing',attempts=attempts+1,claimed_at=now()
    WHERE id=(SELECT id FROM public.watermark_jobs WHERE (p_beat IS NULL OR beat_id=p_beat)
      AND attempts<5 AND (status IN ('pending','failed') OR (status='processing' AND claimed_at<now()-interval '10 minutes'))
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
END; $$;
CREATE OR REPLACE FUNCTION public.claim_delivery_job(p_item UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.delivery_jobs SET claimed_at=now(),attempts=attempts+1
    WHERE order_item_id=p_item AND sent_at IS NULL AND (claimed_at IS NULL OR claimed_at<now()-interval '10 minutes');
  RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_watermark(p_beat UUID,p_source TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO public.watermark_jobs(beat_id,storage_path,status,attempts) VALUES(p_beat,p_source,'pending',0)
  ON CONFLICT(beat_id) DO UPDATE SET storage_path=EXCLUDED.storage_path,status='pending',attempts=0,claimed_at=NULL,error=NULL
    WHERE watermark_jobs.storage_path IS DISTINCT FROM EXCLUDED.storage_path OR watermark_jobs.status<>'processing' OR watermark_jobs.claimed_at<now()-interval '10 minutes';
END; $$;
CREATE OR REPLACE FUNCTION public.queue_saved_master()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.status='pending' AND COALESCE(NEW.file_wav_url,NEW.file_mp3_url) IS NOT NULL THEN
    PERFORM public.enqueue_watermark(NEW.id,COALESCE(NEW.file_wav_url,NEW.file_mp3_url));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER queue_saved_master AFTER INSERT OR UPDATE OF file_mp3_url,file_wav_url,status ON public.beats FOR EACH ROW EXECUTE FUNCTION public.queue_saved_master();

CREATE OR REPLACE FUNCTION public.save_payout_preferences(p_user UUID,p_details JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_details->>'default_payout' NOT IN ('bank','mobile_money') OR length(p_details::TEXT)>10000 THEN RAISE EXCEPTION 'Invalid payout preferences'; END IF;
  UPDATE public.producer_settings SET bank_details=p_details WHERE user_id=p_user;
  INSERT INTO public.wallets(producer_id,bank_details) VALUES(p_user,p_details)
  ON CONFLICT(producer_id) DO UPDATE SET
    recipient_code=CASE WHEN wallets.bank_details->'bank' IS DISTINCT FROM p_details->'bank' THEN NULL ELSE wallets.recipient_code END,
    mobile_money_recipient_code=CASE WHEN wallets.bank_details->'mobile_money' IS DISTINCT FROM p_details->'mobile_money' THEN NULL ELSE wallets.mobile_money_recipient_code END,
    bank_details=p_details;
END; $$;

-- Freeze allocations at checkout; serialize split edits on the same beat lock.
CREATE OR REPLACE FUNCTION public.guard_split_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.beat_id<>OLD.beat_id THEN RAISE EXCEPTION 'Split cannot be moved to another beat'; END IF;
  PERFORM 1 FROM public.beats WHERE id=NEW.beat_id FOR UPDATE;
  IF NEW.split_percentage + COALESCE((SELECT sum(split_percentage) FROM public.beat_collaborators
    WHERE beat_id=NEW.beat_id AND id<>NEW.id),0)>100 THEN RAISE EXCEPTION 'Splits exceed 100 percent'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER guard_split_total BEFORE INSERT OR UPDATE ON public.beat_collaborators FOR EACH ROW EXECUTE FUNCTION public.guard_split_total();

CREATE OR REPLACE FUNCTION public.preserve_beat_assets()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Archive beats instead of deleting purchased assets'; END IF;
  IF (TG_OP='INSERT' OR NEW.file_mp3_url IS DISTINCT FROM OLD.file_mp3_url) AND NEW.file_mp3_url IS NOT NULL AND (NEW.file_mp3_url NOT LIKE 'masters/'||NEW.producer_id||'/%' OR NEW.file_mp3_url ~ '[%\\?\s]' OR NEW.file_mp3_url LIKE '%..%') THEN RAISE EXCEPTION 'Invalid master ownership'; END IF;
  IF (TG_OP='INSERT' OR NEW.file_wav_url IS DISTINCT FROM OLD.file_wav_url) AND NEW.file_wav_url IS NOT NULL AND (NEW.file_wav_url NOT LIKE 'masters/'||NEW.producer_id||'/%' OR NEW.file_wav_url ~ '[%\\?\s]' OR NEW.file_wav_url LIKE '%..%') THEN RAISE EXCEPTION 'Invalid master ownership'; END IF;
  IF (TG_OP='INSERT' OR NEW.file_stems_url IS DISTINCT FROM OLD.file_stems_url) AND NEW.file_stems_url IS NOT NULL AND (NEW.file_stems_url NOT LIKE 'stems/'||NEW.producer_id||'/%' OR NEW.file_stems_url ~ '[%\\?\s]' OR NEW.file_stems_url LIKE '%..%') THEN RAISE EXCEPTION 'Invalid stems ownership'; END IF;
  -- Historical purchases still reference current files; do not change those keys.
  IF TG_OP='UPDATE' AND (NEW.file_mp3_url IS DISTINCT FROM OLD.file_mp3_url OR NEW.file_wav_url IS DISTINCT FROM OLD.file_wav_url OR NEW.file_stems_url IS DISTINCT FROM OLD.file_stems_url)
    AND EXISTS(SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE i.beat_id=OLD.id AND o.status='completed' AND i.asset_snapshot IS NULL)
    THEN RAISE EXCEPTION 'Historical purchased files must be retained'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER preserve_beat_assets BEFORE INSERT OR UPDATE OR DELETE ON public.beats FOR EACH ROW EXECUTE FUNCTION public.preserve_beat_assets();

CREATE OR REPLACE FUNCTION public.enforce_beat_entitlements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE tier TEXT; cap INT;
BEGIN
  IF current_setting('role',true) <> 'authenticated' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users_profiles WHERE id=NEW.producer_id AND role='producer') THEN RAISE EXCEPTION 'Producer account required'; END IF;
  IF TG_OP='UPDATE' AND (NEW.producer_id IS DISTINCT FROM OLD.producer_id OR NEW.is_exclusive_sold IS DISTINCT FROM OLD.is_exclusive_sold OR NEW.exclusive_order_id IS DISTINCT FROM OLD.exclusive_order_id OR NEW.exclusive_reserved_until IS DISTINCT FROM OLD.exclusive_reserved_until)
    THEN RAISE EXCEPTION 'Server-managed sale state'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND NEW.status='draft' THEN RAISE EXCEPTION 'Draft autosave cannot overwrite a published or processing beat'; END IF;
  IF TG_OP='INSERT' AND (NEW.is_exclusive_sold OR NEW.exclusive_order_id IS NOT NULL OR NEW.exclusive_reserved_until IS NOT NULL) THEN RAISE EXCEPTION 'Server-managed sale state'; END IF;
  tier:=public.active_tier(NEW.producer_id); cap:=CASE tier WHEN 'PRO' THEN 2147483647 WHEN 'STARTER' THEN 100 ELSE 20 END;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.producer_id::TEXT,42));
  IF NEW.status<>'hidden' AND (SELECT count(*) FROM public.beats WHERE producer_id=NEW.producer_id AND status<>'hidden' AND id<>NEW.id)>=cap THEN RAISE EXCEPTION 'Upload quota reached'; END IF;
  IF tier='FREE' AND NEW.file_wav_url IS NOT NULL AND (TG_OP='INSERT' OR NEW.file_wav_url IS DISTINCT FROM OLD.file_wav_url) THEN RAISE EXCEPTION 'WAV requires STARTER'; END IF;
  IF tier<>'PRO' AND NEW.file_stems_url IS NOT NULL AND (TG_OP='INSERT' OR NEW.file_stems_url IS DISTINCT FROM OLD.file_stems_url) THEN RAISE EXCEPTION 'Stems require PRO'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER enforce_beat_entitlements BEFORE INSERT OR UPDATE ON public.beats FOR EACH ROW EXECUTE FUNCTION public.enforce_beat_entitlements();
CREATE OR REPLACE FUNCTION public.active_tier_for_owner(p_user UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE((SELECT CASE WHEN subscription_active IS NOT FALSE AND subscription_expires_at>now()
    AND subscription_tier IN ('STARTER','PRO') THEN subscription_tier ELSE 'FREE' END
    FROM public.producer_settings WHERE user_id=p_user AND user_id=(SELECT auth.uid())), 'FREE');
$$;
REVOKE ALL ON FUNCTION public.active_tier_for_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_tier_for_owner(UUID) TO authenticated, service_role;
CREATE POLICY paid_templates ON public.license_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING(public.active_tier_for_owner(producer_id) IN ('STARTER','PRO'))
  WITH CHECK(public.active_tier_for_owner(producer_id) IN ('STARTER','PRO'));

-- Restrictive policies constrain ALL older permissive policies (including names
-- inherited from table renames) without deleting or rewriting existing rows.
CREATE POLICY verified_review_insert ON public.beat_reviews AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (reviewer_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE i.beat_id=beat_reviews.beat_id AND o.buyer_id=(SELECT auth.uid()) AND o.status='completed'));
CREATE POLICY verified_review_update ON public.beat_reviews AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (reviewer_id=(SELECT auth.uid())) WITH CHECK (reviewer_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE i.beat_id=beat_reviews.beat_id AND o.buyer_id=(SELECT auth.uid()) AND o.status='completed'));
CREATE POLICY member_message_insert ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (sender_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id AND (c.participant_1=(SELECT auth.uid()) OR c.participant_2=(SELECT auth.uid()))));
ALTER TABLE public.messages ADD CONSTRAINT message_content_size CHECK(length(trim(content)) BETWEEN 1 AND 5000) NOT VALID;
ALTER TABLE public.beat_comments ADD CONSTRAINT comment_content_size CHECK(length(trim(content)) BETWEEN 1 AND 2000) NOT VALID;
REVOKE INSERT ON public.messages, public.beat_comments FROM PUBLIC, anon, authenticated;
-- Offers and orders are priced and transitioned through server APIs only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.offers, public.orders, public.producer_audiences FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.orders, public.order_items, public.order_item_licenses,
  public.conversations, public.messages, public.notifications, public.favorites,
  public.producer_audiences, public.promo_codes, public.service_bookings,
  public.watermark_jobs, public.license_templates FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- RLS-aware public views require a separate non-sensitive public tier source.
CREATE TABLE IF NOT EXISTS public.producer_public_tiers(user_id UUID PRIMARY KEY REFERENCES public.users_profiles(id),subscription_tier TEXT NOT NULL, expires_at TIMESTAMPTZ);
ALTER TABLE public.producer_public_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_tiers_read ON public.producer_public_tiers FOR SELECT USING(true);
REVOKE ALL ON public.producer_public_tiers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.producer_public_tiers TO anon, authenticated;
GRANT ALL ON public.producer_public_tiers TO service_role;
-- Projection initialization only; original billing rows and balances unchanged.
INSERT INTO public.producer_public_tiers SELECT user_id,public.active_tier(user_id),subscription_expires_at FROM public.producer_settings ON CONFLICT(user_id) DO UPDATE SET subscription_tier=EXCLUDED.subscription_tier,expires_at=EXCLUDED.expires_at;
CREATE OR REPLACE FUNCTION public.sync_public_tier()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO public.producer_public_tiers VALUES(NEW.user_id,public.active_tier(NEW.user_id),NEW.subscription_expires_at) ON CONFLICT(user_id) DO UPDATE SET subscription_tier=EXCLUDED.subscription_tier,expires_at=EXCLUDED.expires_at;
  RETURN NEW;
END; $$;
CREATE TRIGGER sync_public_tier AFTER INSERT OR UPDATE ON public.producer_settings FOR EACH ROW EXECUTE FUNCTION public.sync_public_tier();

-- Anonymous reads are column-scoped. Owners retain private fields behind RLS.
REVOKE SELECT ON public.beats FROM PUBLIC, anon;
REVOKE SELECT (file_mp3_url,file_wav_url,file_stems_url) ON public.beats FROM PUBLIC, anon;
GRANT SELECT (id, producer_id, title, genre, mood_tags, bpm, key, cover_url, mp3_preview_url, watermarked_preview_url, price_mp3, price_wav, price_trackout, price_exclusive, play_count, is_exclusive_sold, status, is_free, product_type, watermark_status, likes_count, comments_count, created_at, updated_at) ON public.beats TO anon;
CREATE OR REPLACE VIEW search_catalog WITH (security_invoker=true) AS
SELECT 
  b.id,
  b.title,
  b.genre,
  b.bpm,
  b.mood_tags,
  b.producer_id,
  b.cover_url,
  b.mp3_preview_url,
  b.status,
  b.watermark_status,
  b.price_mp3,
  b.price_wav,
  b.price_trackout,
  b.price_exclusive,
  b.is_exclusive_sold,
  b.is_free,
  b.play_count,
  b.product_type,
  b.created_at,
  p.handle as producer_handle,
  p.display_name as producer_display_name,
  CASE WHEN ps.expires_at>now() THEN ps.subscription_tier ELSE 'FREE'::TEXT END AS subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_public_tiers ps ON p.id = ps.user_id
WHERE (b.status = 'active' OR b.status = 'published') 
  AND (b.watermark_status = 'done' OR b.product_type != 'beat');


CREATE OR REPLACE VIEW discovery_feed_trending WITH (security_invoker=true) AS
SELECT
  b.id, b.producer_id, b.title, b.genre, b.mood_tags, b.bpm, b.key,
  b.cover_url, b.mp3_preview_url, b.watermarked_preview_url,
  b.price_mp3, b.price_wav, b.price_trackout, b.price_exclusive,
  b.play_count, b.is_exclusive_sold, b.status, b.is_free, b.product_type,
  b.watermark_status, b.likes_count, b.comments_count,
  b.created_at, b.updated_at,
  calculate_beat_heat_score(
    b.id, b.created_at, b.play_count,
    b.likes_count, b.comments_count,
    (CASE WHEN ps.expires_at>now() THEN ps.subscription_tier ELSE 'FREE'::TEXT END)
  ) AS trending_score,
  (CASE WHEN ps.expires_at>now() THEN ps.subscription_tier ELSE 'FREE'::TEXT END) AS subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_public_tiers ps ON p.id = ps.user_id
WHERE b.status = 'active';

GRANT SELECT ON discovery_feed_trending TO anon, authenticated;

ALTER FUNCTION public.calculate_beat_heat_score(UUID,TIMESTAMPTZ,INTEGER,INTEGER,INTEGER,TEXT) SECURITY INVOKER;
GRANT EXECUTE ON FUNCTION public.calculate_beat_heat_score(UUID,TIMESTAMPTZ,INTEGER,INTEGER,INTEGER,TEXT) TO anon, authenticated;
CREATE POLICY paid_promo_management ON public.promo_codes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.active_tier_for_owner(producer_id) IN ('STARTER','PRO'))
  WITH CHECK (public.active_tier_for_owner(producer_id) IN ('STARTER','PRO') AND discount_value>0 AND (discount_type<>'percentage' OR discount_value<=100));

DO $$ BEGIN IF to_regprocedure('public.calculate_beat_heat_score(uuid,timestamptz,integer,text)') IS NOT NULL THEN ALTER FUNCTION public.calculate_beat_heat_score(UUID,TIMESTAMPTZ,INTEGER,TEXT) SECURITY INVOKER; END IF; END; $$;
-- Apply consistent permissions to all new internal functions. Trigger functions
-- remain invocable by their triggers without exposing callable browser RPCs.
DO $$ DECLARE f REGPROCEDURE; BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('queue_saved_master','eligible_payout_wallets','sales_chart','increment_beat_play_count','transition_offer','enqueue_watermark','save_payout_preferences','enforce_beat_entitlements','consume_request_limit','active_tier','prepare_checkout','settle_order','activate_subscription','begin_payout','finish_payout','claim_watermark_job','claim_delivery_job','guard_split_total','preserve_beat_assets','sync_public_tier') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp',f);
    IF (SELECT prorettype='trigger'::regtype FROM pg_proc WHERE oid=f) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f); END IF;
  END LOOP;
END; $$;
COMMIT;
