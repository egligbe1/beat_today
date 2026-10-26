# BeatToday live Supabase verification

Verified 2026-10-26 using the connected Supabase integration. Project:
`BeatToday` (`chutqhuzargkpcmccfbg`), us-east-1, ACTIVE_HEALTHY.

This verification used only project/migration listings, the security advisor,
and SELECT queries against schema/permission catalogs. No user rows, payments,
balances, private files, or credentials were read. No SQL changes, migrations,
maintenance scripts, upgrades, or application flows were executed by the agent.

## Migration 039 protections are active

The deployed state matches the inspected 039 changes, although the migration
history listing is empty. This confirms effective configuration, not a recorded
migration version or when/how it was applied. Do not replay historical scripts
or apply 039 again merely to fill the history table.

- All seven internal money/promo/reservation RPCs deny execution to anon and
  authenticated, allow service_role, and pin search_path to
  `pg_catalog, public, pg_temp`.
- The five replaced financial function bodies contain the expected positive,
  finite amount validation and mature-ledger clearance protections.
- Wallets, ledger, payouts, and producer_settings have RLS enabled. Their SELECT
  policies restrict reads to the owner; no broad wallet-write policy remains.
- Anon has no SELECT access to those four tables. Authenticated has SELECT but
  no table-level INSERT/UPDATE/DELETE/TRUNCATE privileges. Wallets, ledger and
  payouts also deny all column-level INSERT/UPDATE access to both browser roles.
- Producer-settings column grants allow INSERT only on user_id and UPDATE only
  on user_id, bank_details, updated_at. Subscription fields, earnings, and play
  counters are not directly browser-writable.
- The settings-initialization function has the updated default-row-only body,
  pinned search_path, and no browser execution grants. Both expected producer
  profile setup triggers are present.
- For postgres-created functions, public-schema defaults grant execution to
  service_role; the global default ACL has no PUBLIC execution grant.
  Supabase-managed auth/storage/GraphQL defaults remain outside this change.

These are catalog checks, not live mutation tests. The isolated regression
suite remains the evidence for input rejection and preservation behavior.
No real payment, onboarding, or clearance operation was triggered here.

## Other audit schema assumptions confirmed

- users_profiles has no email column; beats has no storage_path column.
- The beat status constraint excludes sold.
- Wallet producer_id references auth.users, not users_profiles.
- License records reference order_items, with no direct orders FK.
- Deleting a beat cascades to its license rows; order-item beat IDs become null.
- Both catalog views omit master-key columns, but the underlying beats table
  still contains them. Public row/column exposure and privileged R2 source
  validation remain separate work; signed downloads were not requested.

## Remaining advisor findings

- Two views use owner permissions: search_catalog and discovery_feed_trending.
  Review their intended public projections and dependencies before changing
  view execution behavior. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- Ten function overloads lack pinned search paths; eight SECURITY DEFINER
  functions are executable by each browser role. This includes trigger
  functions, which cannot normally be directly called as ordinary RPCs; these
  counts are review signals, not eight confirmed exploitable endpoints.
  [Search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- GraphQL schema-discoverability warnings cover 24 anon-visible and 28
  authenticated-visible objects. Visibility alone does not prove access to
  protected rows. Review grants and RLS together, retaining intended catalog
  access. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)
- Leaked-password protection is disabled. [Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- The running Postgres release (17.4.1.075) has outstanding security patches
  according to the project advisor. Any upgrade is a separate reviewed operation.
  [Upgrade guidance](https://supabase.com/docs/guides/platform/upgrading)

The next application fixes should address cross-account media operations and
purchased-asset retention, then retry-safe financial settlement and the confirmed
schema/query mismatches. No additional database operation is authorized by this
verification request.


## Authorized marketplace-integrity deployment — 2026-10-26

Applied only `20261026154145_marketplace_integrity.sql` via Supabase MCP after
explicit user approval. Supabase migration history confirms version
`20261026154145`, name `marketplace_integrity`. No reset, legacy migration replay,
asset removal, financial operation, provider upgrade or plan purchase occurred.

Before application, pending orders and processing payouts were both zero.
A private local snapshot captured all 17 rows across the 26 original public
tables. After application, comparison using the original columns found no changed
rows or values in any original table (including the catalog, completed orders,
licenses, ledger, wallets and settings). New columns/tables were added as reviewed.
The local snapshot is excluded from Git and is not a full database backup.

`prepare_checkout`, `settle_order`, `activate_subscription`, `begin_payout` and
`finish_payout` deny execute to anon/authenticated and allow service_role. Both
public views have `security_invoker=true`. The security advisor no longer reports
owner-permission views or mutable function search paths. Remaining advisories:
intentional GraphQL schema discoverability, five RLS-protected internal tables
without browser policies (INFO), leaked-password protection disabled (Free plan),
and available Postgres patches. Provider controls remain separately pending.


Matching application revision `1d4a6d1eebfc93cb9f8ef042ac791b276fe8be0c` was
pushed to the existing `dev` deployment branch. Render deployment
`dep-dbfna8p5efls73c8htr0` succeeded and reports Live, running Next.js 15.5.28
on Node 22.23.4. A public HTTP check confirmed a populated homepage, new build
chunks, and no application-error page. Health endpoint returned HTTP 200.
Final isolated test run: 33 passed, 0 failed. Render dependency audit: zero
vulnerabilities. No transaction/transfer/email/media smoke test was performed.

A read-only transaction under `anon` returned one catalog and discovery row;
master MP3/WAV column reads and order reads were denied. Authenticated direct
order insertion was also denied. Background schedules remain separately pending;
no provider plan or Postgres engine change was performed.


## Approved operations completed — 2026-10-26

User explicitly requested background-job activation and Postgres upgrade while
retaining Free. Supabase upgrade tracking ID:
`6e6e1d51-5c90-45df-b964-30c19dbdd274`. Project now ACTIVE_HEALTHY on
`17.11.0.003`; SQL confirms PostgreSQL 17.11. Security advisor no longer reports
a vulnerable Postgres version. Password-breach checking remains a paid-plan item.

A pre-upgrade snapshot captured 68 application/auth/storage/migration tables,
269 rows, and schema metadata/definitions, locally with mode 600. Original-row
comparison found only expected job activity: two mature SALE ledger rows became
AVAILABLE and the wallet moved GHS 6,293.18 pending → available. Total unchanged;
all other original tables and fields matched. This is a local logical snapshot,
not a complete pg_dump/physical backup or copy of stored media.

Production QStash schedules created and verified active:

| Destination | UTC cadence | Schedule ID |
| --- | --- | --- |
| `/api/cron/watermark` | `*/5 * * * *` | `scd_81LvNq8nh4zph2F6EZzLpvyn7ryw` |
| `/api/cron/deliver-licenses` | `*/5 * * * *` | `scd_6ZdT3vXwna3oHJMrd6QjXrZknmky` |
| `/api/cron/clear-funds` | `0 * * * *` | `scd_5Nt1bvgn8J9vVzjmbmTMiZaAxeWB` |
| `/api/cron/payouts?reconcile_only=1` | `15 * * * *` | `scd_66YQ7rmU9ny5YgvKbNdYMjtGiCt4` |
| `/api/cron/payouts` | `*/15 * 1,15 * *` | `scd_7Sxi4rvDCtsVMPMMNhKs8Q2cYEot` |

POST, timeout 300 seconds, retries 3, label `beattoday-background`. Existing four
schedules retained, including health checks and unrelated projects. No account
plan changed. Four UI trial schedules in the unused Google-login account were
paused after production-account verification; none remain active in that account.
Logs confirm HTTP 200 for watermark, delivery, clearance and a separately signed
reconciliation-only check. Full payout initiation was not forced as a smoke test.


## Studio foundation applied — 2026-10-26

With explicit user permission to test/apply, Supabase MCP applied only
`20261026164028_studio_workspace.sql`. It adds five scoped RLS tables and a
request-authenticated command wrapper/private transactional implementation. All
original rows and field values in 67 application/auth/storage tables matched the
pre-change snapshot. No original data, wallet balance, order, license or media
asset was modified. No financial operation was executed by the new migration.

Live permission checks: five new tables have RLS; anon cannot read projects or
execute the command; authenticated callers cannot directly insert projects. An
authenticated role without a user identity sees no project/agreement records.
The public wrapper is SECURITY INVOKER. Security advisor adds only authenticated
schema-discoverability notices for the five new tables; RLS remains enforced.

Source revision `3202cd2` is deployed successfully on Render. Isolated tests: 43
passed; TypeScript and production build passed. Visual checks used fictional
local fixtures, which were excluded from deployment. See STUDIO_BUILD_STATUS.md
for the precise implemented scope and remaining collaboration features.


## Booking-first migration and release — 2026-10-26

User approved only the new booking migration through the explicit approval prompt.
Applied `20261026171617_studio_bookings` via Supabase MCP. Six scheduling tables,
private command/projection functions, invoker wrappers and the agreement-confirmation
trigger were added. All original rows and fields in 72 application/auth/storage
tables matched the private pre-change snapshot. No financial or media action occurred.

New tables have RLS; anon has no raw booking SELECT or write-command execution;
authenticated callers cannot directly insert bookings. Only catalog/free-slot
projections are public. Security advisor adds six authenticated schema-discoverability
notices, with no new definer/search-path or unprotected-table warning.

Feature revision `613d6ac` deployed successfully. Live HTTP checks returned 401 for
an unauthenticated booking write, 200 with empty slots for a nonexistent service,
and 200 for the populated catalog homepage. The signed-in studio entry point loads
without error. No production rooms, services, requests or agreements were seeded
by the agent. See BOOKING_BUILD_STATUS.md for scope, tests and operational limits.

Booking-first onboarding follow-up `d7aae631f03944fea857a6596e024d454cdc061e`
also deployed successfully. New studios are guided through booking setup rather
than an empty project list. No additional SQL or production-data operation was
needed for that presentation change.
