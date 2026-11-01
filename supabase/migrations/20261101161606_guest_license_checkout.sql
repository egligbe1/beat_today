-- Specific approval required. Preserves existing orders, licenses and balances.
-- The existing checkout algorithm moves into a private shared helper; existing
-- signed-in callers retain the same signature. No settlement/balance code changes.
BEGIN;
CREATE SCHEMA checkout_private;
REVOKE ALL ON SCHEMA checkout_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA checkout_private TO service_role;
CREATE TABLE public.guest_checkouts (
 order_id UUID PRIMARY KEY REFERENCES public.orders(id),
 email TEXT NOT NULL CHECK(email=lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
 legal_name TEXT NOT NULL CHECK(length(trim(legal_name)) BETWEEN 2 AND 150),
 receipt_hash TEXT NOT NULL CHECK(receipt_hash~'^[a-f0-9]{64}$'),
 receipt_ciphertext TEXT NOT NULL CHECK(length(receipt_ciphertext) BETWEEN 50 AND 1000),
 receipt_expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '14 days',
 claimed_by UUID REFERENCES public.users_profiles(id),claimed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guest_checkouts_email_unclaimed ON public.guest_checkouts(email) WHERE claimed_by IS NULL;
ALTER TABLE public.guest_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_checkouts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.guest_checkouts TO service_role;
CREATE FUNCTION checkout_private.prepare(p_buyer UUID, p_items JSONB, p_reference TEXT,
  p_rate NUMERIC, p_defaults JSONB, p_promo TEXT, p_offer UUID,p_guest_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  v_order UUID := gen_random_uuid(); v_item JSONB; v_beat public.beats%ROWTYPE;
  v_promo public.promo_codes%ROWTYPE; v_offer public.offers%ROWTYPE;
  v_subtotal NUMERIC := 0; v_eligible NUMERIC := 0; v_discount NUMERIC := 0;
  v_price NUMERIC; v_net NUMERIC; v_type TEXT; v_template JSONB; v_contract TEXT;
  v_producer TEXT; v_buyer TEXT; v_fee NUMERIC; v_collab NUMERIC; v_splits JSONB;
  v_count INT; v_minor BIGINT; v_item_id UUID; v_snapshot JSONB;
BEGIN
  IF p_buyer IS NULL AND (p_guest_name IS NULL OR length(trim(p_guest_name))<2 OR length(p_guest_name)>450 OR p_offer IS NOT NULL) THEN RAISE EXCEPTION 'Guest identity required; offers require sign in'; END IF;
  IF p_buyer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users_profiles WHERE id=p_buyer) THEN RAISE EXCEPTION 'Buyer profile required'; END IF;
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
  IF p_buyer IS NULL THEN v_buyer:=p_guest_name; ELSE SELECT COALESCE(display_name,handle,'Customer') INTO v_buyer FROM public.users_profiles WHERE id=p_buyer; END IF;
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

CREATE OR REPLACE FUNCTION public.prepare_checkout(p_buyer UUID,p_items JSONB,p_reference TEXT,p_rate NUMERIC,p_defaults JSONB,p_promo TEXT DEFAULT NULL,p_offer UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE SQL SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT checkout_private.prepare(p_buyer,p_items,p_reference,p_rate,p_defaults,p_promo,p_offer,NULL)
$$;
CREATE FUNCTION public.prepare_guest_checkout(p_items JSONB,p_reference TEXT,p_rate NUMERIC,p_defaults JSONB,p_email TEXT,p_name TEXT,p_receipt_hash TEXT,p_receipt_ciphertext TEXT,p_promo TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
 IF p_email IS NULL OR p_email<>lower(trim(p_email)) OR length(p_email)>254 OR p_email!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 OR p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 2 AND 150 OR p_name~'[[:cntrl:]]'
 OR p_receipt_hash IS NULL OR p_receipt_hash!~'^[a-f0-9]{64}$' OR p_receipt_ciphertext IS NULL OR length(p_receipt_ciphertext) NOT BETWEEN 50 AND 1000 THEN RAISE EXCEPTION 'Invalid guest checkout identity'; END IF;
 result:=checkout_private.prepare(NULL,p_items,p_reference,p_rate,p_defaults,p_promo,NULL,trim(p_name)||' ('||p_email||')');
 INSERT INTO public.guest_checkouts(order_id,email,legal_name,receipt_hash,receipt_ciphertext)
 VALUES((result->>'order_id')::UUID,p_email,trim(p_name),p_receipt_hash,p_receipt_ciphertext);
 RETURN result;
END $$;

-- Claim execution is service-only. The server must validate a fresh, signed proof
-- sent to the account email before forwarding the authenticated actor and email.
-- Receipt cookies and profile metadata do not authorize claims; this also works
-- safely when Supabase signup email auto-confirmation is enabled.
CREATE FUNCTION public.claim_guest_purchases(p_actor UUID,p_verified_email TEXT) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor UUID:=p_actor;verified_email TEXT;guest RECORD;claimed INTEGER:=0;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in to claim purchases' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO verified_email FROM auth.users WHERE id=actor AND lower(email)=p_verified_email;
 IF verified_email IS NULL OR NOT EXISTS(SELECT 1 FROM public.users_profiles WHERE id=actor) THEN RAISE EXCEPTION 'Verify your email and complete your profile first' USING ERRCODE='42501'; END IF;
 FOR guest IN SELECT g.order_id FROM public.guest_checkouts g JOIN public.orders o ON o.id=g.order_id
  WHERE g.email=verified_email AND g.claimed_by IS NULL AND o.buyer_id IS NULL AND o.status='completed'
  ORDER BY g.order_id FOR UPDATE OF o,g LOOP
  UPDATE public.orders SET buyer_id=actor WHERE id=guest.order_id AND buyer_id IS NULL;
  UPDATE public.order_item_licenses SET buyer_id=actor WHERE order_item_id IN(SELECT id FROM public.order_items WHERE order_id=guest.order_id) AND buyer_id IS NULL;
  UPDATE public.guest_checkouts SET claimed_by=actor,claimed_at=now() WHERE order_id=guest.order_id;
  claimed:=claimed+1;
 END LOOP;
 RETURN claimed;
END $$;

CREATE FUNCTION public.refresh_guest_receipt(p_order UUID,p_hash TEXT,p_ciphertext TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE g public.guest_checkouts%ROWTYPE;
BEGIN
 IF p_hash IS NULL OR p_hash!~'^[a-f0-9]{64}$' OR p_ciphertext IS NULL OR length(p_ciphertext) NOT BETWEEN 50 AND 1000 THEN RAISE EXCEPTION 'Invalid receipt'; END IF;
 SELECT * INTO g FROM public.guest_checkouts WHERE order_id=p_order FOR UPDATE;
 IF NOT FOUND OR g.claimed_by IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.orders WHERE id=p_order AND status='completed' AND buyer_id IS NULL) THEN RETURN NULL; END IF;
 IF g.receipt_expires_at<=now() THEN
  UPDATE public.guest_checkouts SET receipt_hash=p_hash,receipt_ciphertext=p_ciphertext,receipt_expires_at=now()+interval '14 days' WHERE order_id=p_order RETURNING * INTO g;
 END IF;
 RETURN jsonb_build_object('email',g.email,'ciphertext',g.receipt_ciphertext,'expires_at',g.receipt_expires_at);
END $$;
REVOKE ALL ON FUNCTION checkout_private.prepare(UUID,JSONB,TEXT,NUMERIC,JSONB,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION checkout_private.prepare(UUID,JSONB,TEXT,NUMERIC,JSONB,TEXT,UUID,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_checkout(UUID,JSONB,TEXT,NUMERIC,JSONB,TEXT,UUID),public.prepare_guest_checkout(JSONB,TEXT,NUMERIC,JSONB,TEXT,TEXT,TEXT,TEXT,TEXT),public.refresh_guest_receipt(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_checkout(UUID,JSONB,TEXT,NUMERIC,JSONB,TEXT,UUID),public.prepare_guest_checkout(JSONB,TEXT,NUMERIC,JSONB,TEXT,TEXT,TEXT,TEXT,TEXT),public.refresh_guest_receipt(UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.claim_guest_purchases(UUID,TEXT) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_guest_purchases(UUID,TEXT) TO service_role;
COMMIT;
