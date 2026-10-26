# Remediation status — 2026-10-26

The marketplace-integrity migration was applied with explicit user authorization
on 2026-10-26 (Supabase version `20261026154145`). Every original row and field
value across all 26 existing public tables was compared before/after and is
unchanged. A private local data snapshot is retained outside Git. Application
rollout is in progress; the deployed revision will be recorded after verification.
No payment, transfer, mail, storage deletion, plan purchase or Postgres upgrade
was executed.

## Changes prepared

| Audit area | Implementation |
| --- | --- |
| C1/C2 | 039 financial and billing-field restrictions already verified active in BeatToday |
| C3 | Three destructive historical scripts moved unchanged to `supabase/legacy-destructive/*.sql.disabled`; storage-GC execute mode disabled |
| H1 | `prepare_checkout` and `settle_order` commit pricing/snapshots and settlement atomically; durable claimed email jobs retry separately |
| H2 | Exclusive reservations belong to an order; late conflicting payments require reconciliation; sold beats use the existing hidden state |
| H3/H12 | Owner-bound asset validation, unique upload keys, purchase asset snapshots, archived listings, and database deletion/history guards |
| H4 | Durable transfer record and debit in one transaction; same-reference retries; atomic success/failure/reversal handling; separate reconciliation cadence |
| H5 | Payout preferences saved through a scoped server endpoint; invalid profile/email joins removed; automatic transfers restricted to this merchant's GHS rail |
| H6/H7 | Seller-scoped discounts, reserved redemption limits, zero-total checkout, serialized split bounds, and frozen recipient/fee allocations |
| H8 | Payment-reference-bound annual activation; deterministic paid periods; replay and expiration checks |
| H9/H10 | Full immutable purchased text shared by license storage, email and PDF; correct order-item relationship for downloads |
| H11 | One watermark worker, leased claims, bounded retries, atomic job enqueue with saved masters, source-change handling and unique temporary/public output paths |
| H13 | Next.js 15.5.28, sharp 0.35.5, modern Supabase SSR/client, patched dependencies and local Inter fonts; async request API compatibility |
| Other correctness | Completed-only reactive ownership cache; scoped completed-sales analytics and public aggregate sales chart; active-only free downloads; real offer checkout and role-aware transitions; producer quota and paid-template checks |
| Other security | Restrictive review/member policies, server-only message/comment writes, durable rate limits, bounded content and reads, same-origin write checks, safe public links and escaped email text |
| Operations | RLS-aware catalog views with safe public tier projection; fixed function search paths and execution grants; production error logging retained; R2 environment documentation; reviewed job plan |
| Wallet display | GHS settlement balances displayed as GHS rather than converted a second time as USD; clearance text corrected to seven days |

## Required database deployment

Review **only**
[`supabase/migrations/20261026154145_marketplace_integrity.sql`](supabase/migrations/20261026154145_marketplace_integrity.sql).
It adds columns/tables, functions, indexes, triggers, restrictive policies and
grants. It initializes a non-sensitive public tier projection; it does not reset,
delete, or backfill existing transactions, assets, license agreements or balances.

The migration and matching application must run together. Supabase recorded
`20261026154145_marketplace_integrity`; do not reapply it or replay historical SQL.
The dashboard reports no managed backups. A pre-change snapshot of the original
26 public tables was saved locally with private file permissions and excluded
from Git; it is a data snapshot, not a complete Supabase disaster-recovery backup.
Post-change inspection confirms the five key checkout/settlement/subscription/
payout RPCs are executable only by the server role. Both public views use
`security_invoker=true`. The view-definer and mutable-search-path advisories cleared.
Five internal service-only tables intentionally have RLS with no browser policy.
GraphQL discoverability notices remain subject to RLS; two provider warnings
(leaked-password protection and Postgres patches) remain as described below.

## Provider controls still pending

- **Leaked-password protection:** the signed-in dashboard confirms this is
  available only on Supabase Pro and above; BeatToday is on Free. No plan was
  purchased and no unrelated authentication settings were changed.
- **Postgres update:** dashboard offers **17.11.0.003** from **17.4.1.075**. Its
  confirmation warns of up to **one hour offline**, no downgrade to the old
  version, and disk right-sizing. The dialog was cancelled. This needs its own
  approved maintenance/backup plan; it is not bundled into the schema migration.
- **Background schedules:** `npm run jobs:plan` prints the exact proposed QStash
  destinations/cadences. The script creates nothing unless explicitly run with
  `--apply` and a QStash token. Existing schedules are retained. Enable the jobs
  after coordinated deployment and verify signatures against the configured
  public site URL. Payout initiation uses bounded batches on the 1st/15th UTC;
  reconciliation is hourly.

## Verification and practical limits

- PostgreSQL regression tests run in disposable in-memory PGlite, without a
  Supabase connection or environment-file loading. Coverage includes settlement
  rollback/idempotency, exact captured amounts, exclusive reservation conflicts,
  scoped promos, zero-total orders, split bounds, paid offers, payout reversal,
  subscription replay/expiry, RLS, asset ownership, queue leases and public views.
- Pure tests cover asset-path attacks, entitlement expiry, HTML/link escaping,
  GHS display and multi-page full-agreement PDF generation.
- The production build is checked with Supabase pointed at an unused loopback
  port and dummy credentials. It cannot access the user's database.
- Dependency audit is checked separately. See the final task response for final
  check results after the last source changes.
- No live payment, transfer, mail or FFmpeg/media smoke test has been performed.
  Such tests require an isolated provider test setup after deployment. PGlite
  tests validate SQL behavior but are not a multi-connection concurrency test.
- Read-only live reconciliation counts were all zero: pending orders, processing
  payouts, overallocated beats, and completed items missing license snapshots.
  Recheck at deployment, since production may receive new activity meanwhile.
- Late/conflicting verified payments are preserved for manual reconciliation,
  not automatically refunded or granted duplicate exclusive rights. Legacy
  pending orders without checkout snapshots likewise require reviewed handling.
- Intended public catalog/GraphQL discoverability remains public; these warnings
  alone do not indicate access to protected rows. Re-evaluate advisor results
  after deployment rather than revoking access blindly.
