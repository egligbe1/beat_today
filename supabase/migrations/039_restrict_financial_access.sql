-- DATA-PRESERVING security migration. Prepare/review only; apply separately with
-- explicit authorization after checking the deployed schema. Requires 038.
-- No balance backfills, row deletion, resets, or historical payment changes.
BEGIN;

-- Abort on missing prerequisites rather than guessing the deployed baseline.
DO $$
DECLARE
  signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.credit_pending_balance(uuid,numeric)',
    'public.restore_available_balance(uuid,numeric)',
    'public.deduct_available_balance(uuid,numeric)',
    'public.clear_ledger_funds(uuid,numeric,uuid)',
    'public.process_mature_funds(integer)',
    'public.increment_promo_usage(uuid)',
    'public.reserve_exclusive_beat(uuid,integer)'
  ] LOOP
    IF to_regprocedure(signature) IS NULL THEN
      RAISE EXCEPTION 'Missing prerequisite function: %. Review deployed schema before applying 039.', signature;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid IN ('public.producer_settings'::regclass, 'public.wallets'::regclass,
      'public.ledger_transactions'::regclass, 'public.payouts'::regclass)
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Owner RLS must be enabled on settings and financial tables before applying 039';
  END IF;
END;
$$;

-- 006 granted future functions to browser roles; PostgreSQL also grants EXECUTE
-- to PUBLIC by default. These defaults apply to functions created by the role
-- running this migration, so other deployment owners must be reviewed too.
-- PUBLIC's built-in default is global: a schema-only REVOKE cannot remove it.
ALTER DEFAULT PRIVILEGES
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Close every existing overload of these internal RPC names, including grants
-- inherited from PUBLIC. Public play-count/discovery functions are unchanged.
DO $$
DECLARE
  internal_function regprocedure;
BEGIN
  FOR internal_function IN
    SELECT p.oid::regprocedure
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'credit_pending_balance', 'restore_available_balance',
        'deduct_available_balance', 'clear_ledger_funds',
        'process_mature_funds', 'increment_promo_usage',
        'reserve_exclusive_beat'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', internal_function);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', internal_function);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', internal_function);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_pending_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Amount must be positive and finite';
  END IF;
  INSERT INTO public.wallets (producer_id, pending_balance)
  VALUES (p_producer_id, p_amount)
  ON CONFLICT (producer_id) DO UPDATE
    SET pending_balance = wallets.pending_balance + EXCLUDED.pending_balance,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Amount must be positive and finite';
  END IF;
  UPDATE public.wallets
  SET available_balance = available_balance + p_amount, updated_at = NOW()
  WHERE producer_id = p_producer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Amount must be positive and finite';
  END IF;
  UPDATE public.wallets
  SET available_balance = available_balance - p_amount, updated_at = NOW()
  WHERE producer_id = p_producer_id AND available_balance >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance or wallet not found';
  END IF;
END;
$$;

-- Keep the existing API signature, but never move a caller-selected amount
-- independent of the locked SALE ledger row. A failed wallet update rolls back
-- the entire call; it cannot leave a cleared ledger with an unchanged wallet.
CREATE OR REPLACE FUNCTION public.clear_ledger_funds(p_producer_id UUID, p_amount NUMERIC, p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  ledger_amount NUMERIC;
BEGIN
  SELECT amount INTO ledger_amount
  FROM public.ledger_transactions
  WHERE id = p_transaction_id AND producer_id = p_producer_id
    AND type = 'SALE' AND status = 'PENDING'
    AND created_at <= NOW() - INTERVAL '7 days'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mature pending sale not found';
  END IF;
  IF ledger_amount IS NULL OR ledger_amount <= 0
      OR ledger_amount::text IN ('NaN', 'Infinity', '-Infinity')
      OR p_amount IS DISTINCT FROM ledger_amount THEN
    RAISE EXCEPTION 'Amount must match the positive finite ledger amount';
  END IF;

  UPDATE public.wallets
  SET pending_balance = pending_balance - ledger_amount,
      available_balance = available_balance + ledger_amount,
      updated_at = NOW()
  WHERE producer_id = p_producer_id AND pending_balance >= ledger_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient pending balance or wallet not found';
  END IF;

  UPDATE public.ledger_transactions
  SET status = 'AVAILABLE', clearance_date = NOW()
  WHERE id = p_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_mature_funds(p_clearance_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  ledger_row RECORD;
  cleared_count INTEGER := 0;
BEGIN
  IF p_clearance_days IS NULL OR p_clearance_days < 7 THEN
    RAISE EXCEPTION 'Clearance window must be at least seven days';
  END IF;
  FOR ledger_row IN
    SELECT id, producer_id, amount
    FROM public.ledger_transactions
    WHERE status = 'PENDING' AND type = 'SALE'
      AND created_at <= NOW() - make_interval(days => p_clearance_days)
    ORDER BY producer_id, id
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.clear_ledger_funds(ledger_row.producer_id, ledger_row.amount, ledger_row.id);
    cleared_count := cleared_count + 1;
  END LOOP;
  RETURN cleared_count;
END;
$$;

-- CREATE OR REPLACE preserves the existing function ACLs closed above.
-- Remove table-level AND legacy column-level browser write privileges. Financial
-- tables stay read-only behind owner RLS, including TRUNCATE/REFERENCES/TRIGGER.
REVOKE ALL ON TABLE public.producer_settings, public.wallets,
  public.ledger_transactions, public.payouts FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
  table_name TEXT;
  column_list TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['producer_settings', 'wallets', 'ledger_transactions', 'payouts'] LOOP
    SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
    INTO column_list
    FROM pg_catalog.pg_attribute
    WHERE attrelid = format('public.%I', table_name)::regclass
      AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', column_list, table_name);
  END LOOP;
END;
$$;

GRANT SELECT ON TABLE public.producer_settings, public.wallets,
  public.ledger_transactions, public.payouts TO authenticated;
-- Onboarding upserts only user_id; billing fields retain server defaults.
GRANT INSERT (user_id) ON public.producer_settings TO authenticated;
GRANT UPDATE (user_id, bank_details, updated_at) ON public.producer_settings TO authenticated;
GRANT ALL ON TABLE public.producer_settings, public.wallets,
  public.ledger_transactions, public.payouts TO service_role;

-- The legacy profile trigger inserts total_plays explicitly as the caller.
-- Keep producer onboarding working with restricted column grants. This trigger
-- only inserts a FREE default row for NEW.id; it accepts no billing input.
CREATE OR REPLACE FUNCTION public.handle_new_producer_settings()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    INSERT INTO public.producer_settings (user_id, total_plays)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_producer_settings() FROM PUBLIC, anon, authenticated;

COMMIT;
