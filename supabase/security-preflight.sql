-- READ-ONLY inspection for 039. Do not append migrations or setup scripts.
-- Run only against the intended project after obtaining authorization to inspect
-- it. Results describe configuration and contain no user rows or credentials.

SELECT current_database() AS database_name, current_user AS inspection_role,
       current_setting('server_version') AS postgres_version;

-- Verify expected function signatures, owners, ACLs, and configured search paths.
SELECT n.nspname AS schema_name, p.oid::regprocedure::text AS function_signature,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
       p.proacl, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'credit_pending_balance', 'restore_available_balance',
  'deduct_available_balance', 'clear_ledger_funds', 'process_mature_funds',
  'increment_promo_usage', 'reserve_exclusive_beat',
  'handle_new_producer_settings', 'handle_new_producer_setup'
)
ORDER BY function_signature;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls, c.relacl
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN (
  'producer_settings', 'wallets', 'ledger_transactions', 'payouts'
);

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename IN (
  'producer_settings', 'wallets', 'ledger_transactions', 'payouts'
)
ORDER BY tablename, policyname;

SELECT table_name, column_name, data_type, column_default,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN (
  'producer_settings', 'wallets', 'ledger_transactions', 'payouts'
)
ORDER BY table_name, ordinal_position;

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('producer_settings', 'wallets', 'ledger_transactions', 'payouts')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, column_name, grantee, privilege_type;

-- Global and per-schema defaults must both be reviewed for EVERY deployment
-- owner. 039 changes defaults only for the role that applies it.
SELECT pg_get_userbyid(d.defaclrole) AS owner,
       COALESCE(n.nspname, '(global)') AS schema_name,
       d.defaclobjtype, d.defaclacl
FROM pg_catalog.pg_default_acl d
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclobjtype = 'f';

SELECT t.tgname AS trigger_name, t.tgrelid::regclass::text AS table_name,
       t.tgfoid::regprocedure::text AS function_signature,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t
WHERE NOT t.tgisinternal AND t.tgrelid = 'public.users_profiles'::regclass;
