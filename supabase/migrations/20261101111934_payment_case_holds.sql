-- SPECIFIC APPROVAL REQUIRED. Adds case/audit tables and guards future payouts.
-- No historical backfill, refunds, transfers, balance edits, deletes or resets.
-- Unmatched OPEN cases pause ALL new payouts until an operator reviews them.
BEGIN;
CREATE TABLE public.payment_cases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 case_key TEXT NOT NULL UNIQUE CHECK(length(case_key)<=220),
 reference TEXT CHECK(length(reference)<=150),
 kind TEXT NOT NULL CHECK(kind IN('REFUND','DISPUTE')),
 state TEXT NOT NULL DEFAULT 'OPEN' CHECK(state IN('OPEN','RESOLVED')),
 order_id UUID REFERENCES public.orders(id),
 subscription_user_id UUID REFERENCES public.users_profiles(id),
 last_event TEXT NOT NULL,
 amount_minor BIGINT CHECK(amount_minor>=0),currency TEXT CHECK(length(currency)=3),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ,resolved_by UUID REFERENCES public.users_profiles(id),resolution TEXT
);
CREATE TABLE public.payment_case_events (
 event_hash TEXT PRIMARY KEY CHECK(event_hash ~ '^[a-f0-9]{64}$'),
 case_id UUID NOT NULL REFERENCES public.payment_cases(id),
 event_type TEXT NOT NULL,summary JSONB NOT NULL DEFAULT '{}',
 actor_id UUID REFERENCES public.users_profiles(id),created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_cases_open_order ON public.payment_cases(order_id) WHERE state='OPEN';
CREATE INDEX payment_cases_open_subscription ON public.payment_cases(subscription_user_id) WHERE state='OPEN';
CREATE INDEX payment_case_events_case_time ON public.payment_case_events(case_id,created_at);
ALTER TABLE public.payment_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_case_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_cases,public.payment_case_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.payment_cases TO service_role;
GRANT SELECT,INSERT ON public.payment_case_events TO service_role;

CREATE FUNCTION public.payment_payout_blocked(p_producer UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.payment_cases c WHERE c.state='OPEN' AND (
  (c.order_id IS NULL AND c.subscription_user_id IS NULL)
  OR c.subscription_user_id=p_producer
  OR EXISTS(SELECT 1 FROM public.order_items i WHERE i.order_id=c.order_id AND i.producer_id=p_producer)
  OR EXISTS(SELECT 1 FROM public.ledger_transactions l JOIN public.order_items i ON i.id=l.order_item_id
    WHERE i.order_id=c.order_id AND l.producer_id=p_producer AND l.type='SALE')
 ));
$$;

CREATE FUNCTION public.record_payment_case(p_hash TEXT,p_event TEXT,p_reference TEXT,p_amount BIGINT,p_currency TEXT,p_summary JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_id UUID;v_kind TEXT;v_key TEXT;v_order UUID;v_subscription UUID;
BEGIN
 IF p_hash IS NULL OR p_hash!~'^[a-f0-9]{64}$' OR p_event IS NULL OR p_event NOT IN(
 'refund.pending','refund.processing','refund.needs-attention','refund.failed','refund.processed',
 'charge.dispute.create','charge.dispute.remind','charge.dispute.resolve') THEN RAISE EXCEPTION 'Invalid provider event'; END IF;
 IF (p_reference IS NOT NULL AND (length(p_reference)>150 OR length(p_reference)<1))
 OR (p_amount IS NOT NULL AND p_amount<0) OR (p_currency IS NOT NULL AND p_currency!~'^[A-Z]{3}$')
 OR p_summary IS NULL OR jsonb_typeof(p_summary)<>'object' OR octet_length(p_summary::TEXT)>4000 THEN RAISE EXCEPTION 'Invalid case details'; END IF;
 -- Serializes case arrival against payout reservation. No wallet/order rows are
 -- locked here, and no payout or financial record is changed by this command.
 PERFORM pg_advisory_xact_lock(hashtextextended('beattoday:payment-case-payout-gate',0));
 SELECT case_id INTO v_id FROM public.payment_case_events WHERE event_hash=p_hash;
 IF FOUND THEN RETURN v_id; END IF;
 v_kind:=CASE WHEN p_event LIKE 'refund.%' THEN 'REFUND' ELSE 'DISPUTE' END;
 v_key:=v_kind || ':' || coalesce(p_reference,'unmatched:' || p_hash);
 SELECT id INTO v_order FROM public.orders WHERE gateway_reference=p_reference LIMIT 1;
 SELECT user_id INTO v_subscription FROM public.subscription_payments WHERE reference=p_reference;
 INSERT INTO public.payment_cases(case_key,reference,kind,order_id,subscription_user_id,last_event,amount_minor,currency)
 VALUES(v_key,p_reference,v_kind,v_order,v_subscription,p_event,p_amount,p_currency)
 ON CONFLICT(case_key) DO UPDATE SET state='OPEN',order_id=coalesce(EXCLUDED.order_id,payment_cases.order_id),
 subscription_user_id=coalesce(EXCLUDED.subscription_user_id,payment_cases.subscription_user_id),last_event=EXCLUDED.last_event,
 amount_minor=EXCLUDED.amount_minor,currency=EXCLUDED.currency,updated_at=now(),resolved_at=NULL,resolved_by=NULL,resolution=NULL
 RETURNING id INTO v_id;
 INSERT INTO public.payment_case_events(event_hash,case_id,event_type,summary) VALUES(p_hash,v_id,p_event,p_summary);
 RETURN v_id;
END $$;

CREATE FUNCTION public.resolve_payment_case(p_case UUID,p_actor UUID,p_resolution TEXT,p_note TEXT,p_request UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_state TEXT;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.users_profiles WHERE id=p_actor) OR p_request IS NULL
 OR p_resolution IS NULL OR p_resolution NOT IN('NO_FINANCIAL_LOSS','ACCOUNTING_REVIEW_COMPLETED','UNRELATED_PAYMENT')
 OR p_note IS NULL OR length(btrim(p_note))<20 OR length(p_note)>1000 THEN RAISE EXCEPTION 'A verified operator and review evidence are required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('beattoday:payment-case-payout-gate',0));
 SELECT state INTO v_state FROM public.payment_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
 IF v_state='RESOLVED' THEN RETURN false; END IF;
 UPDATE public.payment_cases SET state='RESOLVED',resolved_by=p_actor,resolved_at=now(),resolution=p_resolution,updated_at=now() WHERE id=p_case;
 INSERT INTO public.payment_case_events(event_hash,case_id,event_type,summary,actor_id)
 VALUES(encode(sha256(convert_to('operator:' || p_request::TEXT,'UTF8')),'hex'),p_case,'operator.resolve',jsonb_build_object('resolution',p_resolution,'note',p_note),p_actor);
 RETURN true;
END $$;

-- Keep reservation behavior, but check a durable hold before reserving any funds.
CREATE OR REPLACE FUNCTION public.begin_payout(p_producer UUID,p_amount NUMERIC,p_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_id UUID;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('beattoday:payment-case-payout-gate',0));
 IF public.payment_payout_blocked(p_producer) THEN RAISE EXCEPTION 'Payout paused for payment review' USING ERRCODE='P0423'; END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.eligible_payout_wallets()
RETURNS SETOF public.wallets LANGUAGE SQL STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT w.* FROM public.wallets w WHERE w.available_balance>=50 AND NOT public.payment_payout_blocked(w.producer_id)
 AND NOT EXISTS(SELECT 1 FROM public.payouts p WHERE p.producer_id=w.producer_id AND p.status='PROCESSING')
 AND (CASE WHEN w.bank_details->>'default_payout'='mobile_money' THEN w.mobile_money_recipient_code ELSE w.recipient_code END) IS NOT NULL
 AND (CASE WHEN w.bank_details->>'default_payout'='mobile_money' THEN w.bank_details->'mobile_money'->>'country'
 ELSE coalesce(w.bank_details->'bank'->>'country',w.bank_details->>'country') END)='Ghana'
 ORDER BY w.last_payout_at NULLS FIRST,w.producer_id LIMIT 5;
$$;

CREATE FUNCTION public.guard_payment_case_payout() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.status='PROCESSING' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('beattoday:payment-case-payout-gate',0));
  IF public.payment_payout_blocked(NEW.producer_id) THEN RAISE EXCEPTION 'Payout paused for payment review' USING ERRCODE='P0423'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_case_payout_guard BEFORE INSERT ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.guard_payment_case_payout();

REVOKE ALL ON FUNCTION public.payment_payout_blocked(UUID),public.record_payment_case(TEXT,TEXT,TEXT,BIGINT,TEXT,JSONB),
 public.resolve_payment_case(UUID,UUID,TEXT,TEXT,UUID),public.guard_payment_case_payout(),public.begin_payout(UUID,NUMERIC,JSONB),public.eligible_payout_wallets()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payment_payout_blocked(UUID),public.record_payment_case(TEXT,TEXT,TEXT,BIGINT,TEXT,JSONB),
 public.resolve_payment_case(UUID,UUID,TEXT,TEXT,UUID),public.begin_payout(UUID,NUMERIC,JSONB),public.eligible_payout_wallets() TO service_role;
COMMIT;
