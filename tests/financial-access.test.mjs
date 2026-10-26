// Standalone PostgreSQL regression tests. PGlite is loaded only from a supplied
// local module path; no credentials, network connection, or real DB is used.
// Run: PGLITE_MODULE_PATH=/absolute/path/to/pglite/dist/index.js node --test tests/financial-access.test.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const producer = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const sale = '00000000-0000-4000-8000-000000000003'
const sqlFile = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')

test('financial access migration on an isolated PostgreSQL fixture', async t => {
  const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite')
  const db = await PGlite.create()
  t.after(() => db.close())

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_user_meta_data jsonb DEFAULT '{}'
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  `)
  // Load actual legacy grants/policies and setup triggers. Never include reset,
  // wipe, seed, or consolidated setup scripts in this fixture.
  for (const name of [
    '001_core_identity.sql', '003_financial_engine.sql',
    '006_permissions_and_sync.sql', '010_add_subscription_reference.sql',
    '016_auto_producer_settings.sql',
  ]) await db.exec(await sqlFile(name))

  await db.exec(`
    CREATE TABLE public.beats (id uuid PRIMARY KEY, is_exclusive_sold boolean DEFAULT false);
    CREATE TABLE public.notifications (user_id uuid);
    CREATE TABLE public.promo_codes (
      id uuid PRIMARY KEY, uses_count integer DEFAULT 0, is_active boolean DEFAULT true,
      max_uses integer, expires_at timestamptz
    );
  `)
  // The public catalog view at the end of 038 is unrelated to these tests.
  const previous = await sqlFile('038_financial_and_security_hardening.sql')
  assert.ok(previous.includes('-- 9. Discovery view:'))
  await db.exec(previous.slice(0, previous.indexOf('-- 9. Discovery view:')))
  // Exercise legacy column grants and alternate RPC signatures as well.
  await db.exec(`
    GRANT UPDATE (subscription_tier) ON public.producer_settings TO authenticated;
    CREATE FUNCTION public.credit_pending_balance(uuid, integer, text)
      RETURNS void LANGUAGE sql AS $$ SELECT $$;
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES ('${producer}', 'fixture@example.invalid', '{"role":"producer"}');
    UPDATE public.wallets SET available_balance = 100, pending_balance = 25 WHERE producer_id = '${producer}';
    UPDATE public.producer_settings SET subscription_tier = 'STARTER', bank_details = '{"fixture":true}' WHERE user_id = '${producer}';
  `)
  const migration = await sqlFile('039_restrict_financial_access.sql')
  const before = (await db.query('SELECT * FROM public.wallets ORDER BY producer_id')).rows
  const settingsBefore = (await db.query('SELECT * FROM public.producer_settings ORDER BY user_id')).rows
  await db.exec(migration)

  async function asRole(role, callback, user = producer) {
    await db.exec(`SET ROLE ${role}`)
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user])
    try { return await callback() } finally { await db.exec('RESET ROLE') }
  }
  async function denied(sql) {
    await assert.rejects(db.exec(sql), err => err.code === '42501')
  }
  const wallet = async () => (await db.query('SELECT available_balance::text, pending_balance::text FROM public.wallets WHERE producer_id = $1', [producer])).rows[0]

  await t.test('application preserves existing wallet and settings rows', async () => {
    assert.deepEqual((await db.query('SELECT * FROM public.wallets ORDER BY producer_id')).rows, before)
    assert.deepEqual((await db.query('SELECT * FROM public.producer_settings ORDER BY user_id')).rows, settingsBefore)
  })

  await t.test('all internal RPC overloads deny browser roles and allow service role', async () => {
    const { rows } = await db.query(`
      SELECT p.oid::regprocedure::text AS name,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
        'credit_pending_balance','restore_available_balance','deduct_available_balance',
        'clear_ledger_funds','process_mature_funds','increment_promo_usage','reserve_exclusive_beat'
      )
    `)
    assert.equal(rows.length, 8)
    for (const row of rows) {
      assert.equal(row.anon, false, row.name)
      assert.equal(row.authenticated, false, row.name)
      assert.equal(row.service, true, row.name)
    }
    for (const role of ['anon', 'authenticated']) {
      await asRole(role, () => denied(`SELECT public.credit_pending_balance('${producer}', 999)`))
    }
  })

  await t.test('owner cannot upgrade, spoof counters, delete or reinsert paid settings', async () => {
    await asRole('authenticated', async () => {
      for (const assignment of ["subscription_tier = 'PRO'", "subscription_active = true", "subscription_reference = 'fake'", "subscription_expires_at = now() + interval '10 years'", 'total_earnings = 999999', 'total_plays = 999999']) {
        await denied(`UPDATE public.producer_settings SET ${assignment} WHERE user_id = '${producer}'`)
      }
      await denied(`DELETE FROM public.producer_settings WHERE user_id = '${producer}'`)
      await denied(`INSERT INTO public.producer_settings (user_id, subscription_tier) VALUES ('${producer}', 'PRO') ON CONFLICT (user_id) DO UPDATE SET subscription_tier = 'PRO'`)
    })
  })

  await t.test('financial table writes remain denied while owners can read balances', async () => {
    for (const role of ['anon', 'authenticated']) {
      await asRole(role, async () => {
        await denied(`UPDATE public.wallets SET available_balance = 999 WHERE producer_id = '${producer}'`)
        await denied(`INSERT INTO public.ledger_transactions (producer_id, amount, type) VALUES ('${producer}', 999, 'SALE')`)
        await denied(`INSERT INTO public.payouts (producer_id, amount, reference) VALUES ('${producer}', 999, 'forged')`)
      })
    }
    await asRole('authenticated', async () => {
      assert.equal((await db.query('SELECT * FROM public.wallets')).rows.length, 1)
    })
    await asRole('authenticated', async () => {
      assert.equal((await db.query('SELECT * FROM public.wallets')).rows.length, 0)
    }, other)
    const { rows } = await db.query(`
      SELECT tablename, has_table_privilege('authenticated', 'public.' || tablename, 'TRUNCATE') AS can_truncate
      FROM pg_tables WHERE schemaname = 'public'
        AND tablename IN ('producer_settings', 'wallets', 'ledger_transactions', 'payouts')
    `)
    assert.equal(rows.length, 4)
    assert.ok(rows.every(row => !row.can_truncate))
  })

  await t.test('onboarding upsert and owner preferences still work, other owners are isolated', async () => {
    await asRole('authenticated', async () => {
      await db.exec(`INSERT INTO public.producer_settings (user_id) VALUES ('${producer}') ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id`)
      await db.exec(`UPDATE public.producer_settings SET bank_details = '{"fixture":"updated"}', updated_at = now() WHERE user_id = '${producer}'`)
    })
    await asRole('authenticated', async () => {
      assert.equal((await db.query('SELECT * FROM public.producer_settings')).rows.length, 0)
      await db.exec(`UPDATE public.producer_settings SET bank_details = '{}' WHERE user_id = '${producer}'`)
      await denied(`INSERT INTO public.producer_settings (user_id) VALUES ('${producer}')`)
    }, other)
    assert.equal((await db.query('SELECT bank_details FROM public.producer_settings WHERE user_id = $1', [producer])).rows[0].bank_details.fixture, 'updated')
    await asRole('anon', () => denied('SELECT * FROM public.producer_settings'))
  })

  await t.test('profile triggers create FREE defaults with restricted grants', async () => {
    // Set up an auth user without a producer role, then complete onboarding as
    // that authenticated user so the legacy invoker trigger is exercised.
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${other}', 'new@example.invalid')`)
    await asRole('authenticated', () => db.exec(`UPDATE public.users_profiles SET role = 'producer' WHERE id = '${other}'`), other)
    const { rows } = await db.query('SELECT subscription_tier, total_plays FROM public.producer_settings WHERE user_id = $1', [other])
    assert.equal(rows[0].subscription_tier, 'FREE')
    assert.equal(Number(rows[0].total_plays), 0)
    await asRole('service_role', () => db.exec(`UPDATE public.producer_settings SET subscription_tier = 'PRO' WHERE user_id = '${other}'`))
  })

  await t.test('server balance operations reject invalid amounts without changing money', async () => {
    await asRole('service_role', async () => {
      for (const name of ['credit_pending_balance','restore_available_balance','deduct_available_balance']) {
        for (const amount of ['NULL', '0', '-1', "'NaN'::numeric", "'Infinity'::numeric", "'-Infinity'::numeric"]) {
          await assert.rejects(db.exec(`SELECT public.${name}('${producer}', ${amount})`), /positive and finite/)
        }
      }
      await assert.rejects(db.exec(`SELECT public.deduct_available_balance('${producer}', 101)`), /Insufficient balance/)
      assert.deepEqual(await wallet(), { available_balance: '100', pending_balance: '25' })
      await db.exec(`SELECT public.credit_pending_balance('${producer}', 5); SELECT public.deduct_available_balance('${producer}', 10); SELECT public.restore_available_balance('${producer}', 10);`)
      assert.deepEqual(await wallet(), { available_balance: '100', pending_balance: '30' })
    })
  })

  await t.test('clearance uses a mature sale amount exactly once and rolls back mismatches', async () => {
    await db.exec(`INSERT INTO public.ledger_transactions (id, producer_id, amount, type, status, created_at) VALUES ('${sale}', '${producer}', 10, 'SALE', 'PENDING', now() - interval '8 days')`)
    await asRole('service_role', async () => {
      await assert.rejects(db.exec(`SELECT public.clear_ledger_funds('${producer}', 100, '${sale}')`), /must match/)
      await assert.rejects(db.exec('SELECT public.process_mature_funds(0)'), /at least seven/)
      assert.deepEqual(await wallet(), { available_balance: '100', pending_balance: '30' })
      assert.equal((await db.query('SELECT public.process_mature_funds() AS count')).rows[0].count, 1)
      assert.equal((await db.query('SELECT public.process_mature_funds() AS count')).rows[0].count, 0)
      assert.deepEqual(await wallet(), { available_balance: '110', pending_balance: '20' })
      await assert.rejects(db.exec(`SELECT public.clear_ledger_funds('${producer}', 10, '${sale}')`), /not found/)
    })
    await db.exec(`UPDATE public.ledger_transactions SET status = 'PENDING', amount = 21 WHERE id = '${sale}'`)
    await asRole('service_role', () => assert.rejects(db.exec(`SELECT public.clear_ledger_funds('${producer}', 21, '${sale}')`), /Insufficient pending/))
    assert.equal((await db.query('SELECT status FROM public.ledger_transactions WHERE id = $1', [sale])).rows[0].status, 'PENDING')
    assert.deepEqual(await wallet(), { available_balance: '110', pending_balance: '20' })
    await db.exec(`UPDATE public.ledger_transactions SET amount = 10, created_at = now() WHERE id = '${sale}'`)
    await asRole('service_role', () => assert.rejects(db.exec(`SELECT public.clear_ledger_funds('${producer}', 10, '${sale}')`), /not found/))
  })

  await t.test('new functions default to no browser execution and migration can be reapplied', async () => {
    await db.exec('CREATE FUNCTION public.future_internal_test() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$')
    const { rows } = await db.query("SELECT has_function_privilege('anon', 'public.future_internal_test()', 'EXECUTE') AS anon, has_function_privilege('authenticated', 'public.future_internal_test()', 'EXECUTE') AS authenticated")
    assert.deepEqual(rows[0], { anon: false, authenticated: false })
    const current = await wallet()
    await db.exec(migration)
    assert.deepEqual(await wallet(), current)
    // Also parse and execute the read-only deployment inspection against this
    // isolated fixture, never against a configured Supabase connection.
    await db.exec(await readFile(new URL('../supabase/security-preflight.sql', import.meta.url), 'utf8'))
  })

  await t.test('migration refuses a baseline with disabled RLS', async () => {
    await db.exec('ALTER TABLE public.wallets DISABLE ROW LEVEL SECURITY')
    await assert.rejects(db.exec(migration), /Owner RLS must be enabled/)
    await db.exec('ROLLBACK')
    await db.exec('ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY')
  })
})
