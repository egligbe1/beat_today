# BeatToday codebase audit

Date: 2026-10-26. Scope: repository-wide architecture and static risk review, with deeper tracing of identity, RLS, checkout, fulfillment, payouts, media, and licenses. During the initial audit, no application or database operations were executed; only this report and project safety instructions were added.

Follow-up: migration `039_restrict_financial_access.sql` was prepared for C1/C2, with isolated PostgreSQL regression tests and safer setup documentation. On 2026-10-26, read-only Supabase verification confirmed its protections are active in BeatToday; the agent did not apply it. Migration history is empty, so this conclusion comes from effective grants, function bodies, defaults and RLS. See `supabase/LIVE_VERIFICATION.md` and `supabase/SECURITY_ROLLOUT.md`. The findings below retain the original audit evidence; remaining findings are not remediated by 039.

Subsequent remediation is implemented locally in application code and the pending
timestamped marketplace-integrity migration. See `REMEDIATION_STATUS.md` for the
finding-by-finding mapping, validation, and outstanding deployment/provider actions.
The original audit below remains historical evidence, not a description of the
new local implementation or a claim that pending changes are live.

This is not a claim that every possible defect has been found. The initial audit was static; subsequent limited live schema/grant verification is documented separately. Backups, deployment infrastructure, payment account capabilities, and runtime behavior remain unverified.

## What you are building

BeatToday is a two-sided music marketplace for independent producers and recording artists. Producers publish beats, set license prices, upload clean audio and optional stems, share profiles, negotiate offers, and earn payouts. Artists discover and preview music, follow producers, save favorites, communicate, purchase licenses, and access purchased assets and agreements.

The commercial model combines marketplace commissions with annual subscriptions. FREE has 20 beats and a 20% platform fee; STARTER has 100 beats and a 10% fee; PRO has unlimited beats and a 0% fee. Other tier entitlements include WAV/stems, customized agreements, promotional codes, analytics, and custom producer tags. The annual subscription endpoint currently prices STARTER at USD 9.99 and PRO at USD 59.99.

The catalog supports beats, drumkits, and sample packs at the schema level. Collections, collaborators and revenue splits, reviews, comments, email-gated free downloads, and a vertical discovery feed extend the core marketplace. Producer services/bookings have database structures but the profile UI still has coming-soon sections. Offer negotiation also has incomplete purchasing integration.

## Architecture and data flow

| Layer | Implementation and responsibility |
| --- | --- |
| Web application | Next.js 14.1.0 App Router, React 18, TypeScript, Tailwind, framer-motion; server-rendered pages plus client interactions |
| Identity | Supabase Auth, cookie-bound server/browser clients, middleware dashboard guard, request-cached auth helper |
| Data | Supabase Postgres and RLS; service-role clients in privileged APIs; public clients for catalog reads |
| Audio and media | Cloudflare R2 public covers/previews/avatars/tags; private masters/stems; presigned browser uploads and buyer downloads; ffmpeg watermark processing |
| Commerce | Paystack GHS checkout; USD catalog pricing; exchange-rate conversion; promo discounts; order/item records |
| Fulfillment | Webhook and verification endpoint share `lib/utils/fulfillOrder.ts`; ledger entries, pending wallet credits, license snapshots/PDFs, email, exclusive locking |
| Settlement | Seven-day clearing, wallet available balance, Paystack recipients/transfers, payout status webhooks |
| Background work | QStash signature verification for cron endpoints; watermark jobs table plus an immediate internal fetch |
| Client state | Zustand persisted cart and global player; separate native audio in explore; shared owned-license cache |
| Communication | Resend transactional mail; in-app messages and notifications |

Important domain invariants: wallets and financial records use `producer_id`; subscription tiers and ledger/payout enums are uppercase; favorites use a composite key; service role bypasses RLS; private asset access must be explicitly authorized. See `CLAUDE.md`.

Typical producer flow: sign up/onboard → metadata draft → presigned R2 upload → beat set pending → watermark job → public preview and active catalog listing. Typical buyer flow: discovery → license/cart → server pricing and promotion validation → pending order/items → Paystack → fulfillment → library/downloads. Earnings move from pending to available after seven days, then to an external recipient.

## Critical findings

### C1. Publicly executable financial functions bypass wallet RLS

Evidence: `supabase/migrations/006_permissions_and_sync.sql:9-16` grants all routines to anon/authenticated and establishes permissive future defaults. `003_financial_engine.sql` and `038_financial_and_security_hardening.sql` define SECURITY DEFINER financial functions without caller authorization or execution revocations. No corrective revocations were found.

Impact: callers can potentially invoke balance credit/restore/deduct and clearance functions directly through RPC. Arbitrary producer IDs and amounts are accepted; negative deductions can increase balances. Removing the permissive wallet table policy in migration 038 does not close this function-level route.

Direction: restrict financial execution to service role, validate amounts, derive clearance amounts from ledger records, and fix function search paths. Verify effective live grants read-only before planning an additive migration.

### C2. Producers can assign themselves paid tiers

Evidence: `001_core_identity.sql` owner INSERT/UPDATE policies and `006_permissions_and_sync.sql` owner ALL policy cover the entire `producer_settings` row. Table grants do not restrict subscription columns.

Impact: direct authenticated writes can set `subscription_tier = 'PRO'`, bypass payment and reduce marketplace fees to zero. UI gating does not prevent this.

Direction: separate user-editable preferences from server-managed billing fields, enforce privileges at database level, and centralize verified subscription entitlements.

### C3. Destructive SQL is mixed with normal migrations

Evidence: `supabase/migrations/026_wipe_transaction_history.sql` truncates licenses, orders, ledger, and payouts and zeroes wallets. `MASTER_RESET_CLOUD.sql` and `supabase/SETUP_FRESH.sql` drop the public schema. README recommends applying the numbered migrations in order.

Impact: following setup instructions against an existing project can erase business and financial history.

Direction: quarantine destructive historical scripts from deployable migrations, correct setup documentation, and establish a reviewed migration manifest. None of these scripts was run during this audit.

## High-priority findings

### H1. Fulfillment cannot reliably recover partial failures

Evidence: `lib/utils/fulfillOrder.ts` flips pending to completed before processing ledger, wallet credits, exclusive lock, license insertion, PDF creation, or mail. Item exceptions are swallowed, and many Supabase response errors are ignored. Later calls return immediately for completed orders.

Impact: a paid order can remain permanently missing producer funds or license records; a ledger insert can succeed while wallet credit fails. This is duplicate-entry prevention, not complete transactional idempotency.

Direction: atomically settle financial/entitlement records with per-item uniqueness, then retry external side effects through a durable outbox.

### H2. Exclusive sales have both a schema failure and an ownership race

Evidence: migration 007 permits `draft/pending/active/private/hidden`, but fulfillment writes `status: 'sold'`; the response error is ignored. Migration 038 reservations have a TTL but no order/owner token. A payment after expiration can fulfill after another checkout has reserved or paid for the same beat.

Impact: sold flags/status updates can fail entirely under the committed schema; even with that fixed, two payments can obtain an exclusive entitlement.

Direction: align status values and settle exclusivity in the same database transaction as the order, tied to a specific reservation/order, with defined late-payment reconciliation.

### H3. Watermark APIs trust arbitrary private storage keys

Evidence: `app/api/audio/queue-watermark/route.ts` checks beat ownership but accepts caller-supplied `storage_path`; `app/api/audio/watermark/route.ts` reads that path with server R2 credentials. No binding to the beat's saved master key or producer prefix is checked. Public beat SELECT policies expose full rows, including master keys (`002_catalog_and_storage.sql`, `007_status_alignment.sql`); repairing only the trending view does not restrict the underlying table.

Impact: an authenticated producer can potentially process another producer's master into a public preview under their own beat. Public keys alone are not signed downloads, but the watermark worker becomes a privileged cross-account read path.

Direction: derive the source exclusively from a verified asset record, enforce prefix ownership on every privileged asset operation, and restrict public catalog columns.

### H4. Payouts can strand debited funds without a durable attempt record

Evidence: `app/api/cron/payouts/route.ts` deducts wallet balance before transfer and only creates a payout record after the provider responds. Exceptions only append an error result. Record-insert errors are logged and processing continues. Webhook failure handling changes status before a separate restore RPC.

Impact: timeout, process termination, or database errors can leave debits without recoverable transfer state. A successful transfer followed by a reversal is ignored by the failure handler because it only accepts PROCESSING rows. Blindly restoring after an ambiguous timeout would also risk double spending.

Direction: persist a unique transfer attempt alongside a reserved debit before calling Paystack; reconcile ambiguous outcomes by reference; atomically apply financial webhook transitions.

### H5. Committed schema does not support payout query or saving wallet preferences

Evidence: payout cron embeds `users_profiles(id, email)` from wallets, but wallets references `auth.users`, not profiles, and no profile email column exists in the committed migrations. The cron ignores the query error and reports no eligible payouts. `SettingsForm.tsx:295` writes wallet bank details from the browser; migration 038 leaves wallets with SELECT-only ownership access. Setup-recipient saves recipient codes but not the supplied bank preferences.

Impact: automatic payouts can quietly do nothing; country/default method preferences may not persist, especially mobile-money settings.

Direction: remove invalid joins, surface query errors, and save recipient plus validated payout preferences in a narrow authenticated server operation.

### H6. Producer promotions discount other producers' products

Evidence: `app/api/checkout/route.ts` validates code and usage but never checks `promo.producer_id` against item ownership. It discounts the whole subtotal and applies one payout ratio to all producers.

Impact: a producer-controlled discount can reduce another seller's proceeds. Parallel pending orders can also exceed max uses: redemption is counted only after payment, and the returned false result from `increment_promo_usage` is ignored.

Direction: scope discounts to eligible items and atomically reserve/consume bounded redemptions. Add an explicit path for zero-total orders instead of initializing a zero-value payment.

### H7. Collaborator totals can exceed 100%

Evidence: migration 029 restricts individual percentages but not their sum. Fulfillment sets the primary share to `max(0, 100 - total)` yet pays every collaborator's full percentage.

Impact: multiple valid rows can allocate more than the proceeds collected.

Direction: enforce the aggregate in the database and snapshot validated splits when the commercial transaction is established.

### H8. Subscription callback can replay old payments indefinitely

Evidence: `app/api/subscribe/callback/route.ts` verifies metadata but always sets expiration to one year from the current request; no consumed-reference guard exists. Entitlement checks read tier without enforcing `subscription_expires_at` or `subscription_active`.

Impact: replaying an old successful reference extends access; expiration does not reliably remove premium benefits. Annual purchases are one-time transactions, while the subscription.create webhook is not a substitute for their charge-success settlement.

Direction: persist one-time activation against unique payment references, compute a deterministic paid period, settle independently of browser redirects, and enforce expiration centrally.

### H9. Generated license PDF contradicts the purchased terms

Evidence: `components/licenses/LicensePDF.tsx` always grants non-exclusive rights, including for exclusive purchases. `fulfillOrder.ts` stores custom/default contract text but generates a separate summary PDF with fallback 50,000-stream/one-video terms. Without a custom template, tier-specific defaults do not populate these summary fields. The PDF omits the full saved contract.

Impact: the saved agreement, email, and PDF can describe different rights. This is an implementation consistency finding, not a legal assessment.

Direction: create one immutable purchased agreement snapshot and use it for every view, attachment, and download; explicitly represent unlimited and exclusive terms.

### H10. License re-download uses an unsupported relationship and mutable terms

Evidence: `app/api/licenses/download/route.ts` embeds `orders!inner` directly from `order_item_licenses`, whose declared FK points to `order_items`, not orders. It fetches templates by `name = license_type` rather than mapped type; buyer RLS cannot read producer-owned templates. It does not use `final_legal_text`.

Impact: re-download can return 404 from a relationship error, or produce fallback/current terms rather than the agreement bought.

Direction: join through order_items and render the saved immutable agreement.

### H11. Watermark retry worker is inconsistent with its schema and immediate worker

Evidence: `app/api/cron/watermark/route.ts:71` selects `beats.storage_path`, a nonexistent committed column; the source is `watermark_jobs.storage_path`. The retry worker marks watermark done but never changes pending beats to active. Failures are marked failed while subsequent runs only select pending jobs; no atomic job claim prevents overlapping workers. The initial trigger is an unawaited fetch.

Impact: immediate-worker failure can leave uploads permanently unpublished with no functioning retry. Duplicate work can collide on deterministic temporary file names.

Direction: use one durable worker implementation with atomic claims, bounded retries, unique temporary paths, and consistent publication transitions.

### H12. Deleting beats destroys purchased assets and license history

Evidence: `app/api/beats/[beatId]/route.ts` deletes R2 objects before attempting the database deletion and has no purchase check. License rows reference beats with ON DELETE CASCADE; order item beat IDs become null. Producer-controlled file-key columns also are not validated before privileged deletion.

Impact: purchasers lose downloads and agreement records; a failed DB delete can still remove audio. Forged asset references can potentially target another account's objects.

Direction: archive/unpublish purchased products, retain versioned sold assets and license snapshots, and verify ownership of every object deletion.

### H13. Framework version contains a known middleware authorization vulnerability

Evidence: package.json pins Next.js 14.1.0. The official advisory lists 14.x before 14.2.25 as affected by CVE-2025-29927. Actual exposure depends on deployment and downstream checks; Vercel deployments have provider protection according to the advisory. Repository comments mention Render, but live hosting was not verified.

Source: https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw

Direction: move to a currently maintained patched release after compatibility testing; do not interpret 14.2.25 as a complete current-security recommendation. Keep authorization at the point of data access.

## Additional correctness and abuse risks

1. **Unpaid carts appear owned.** `lib/hooks/useOwnedLicenses.ts` includes pending orders, so abandoned/failed initialization can disable purchase buttons indefinitely. Its global promise is not keyed by user and its invalidation function has no call sites. Fix completed-only entitlements and auth/purchase invalidation.
2. **Producer sales analytics are blocked by order RLS.** `app/dashboard/sales/page.tsx` uses an inner join to orders through a user-scoped client, but orders SELECT only permits the buyer. Producer sales can disappear. If access is repaired, the query also needs completed-status filtering to avoid counting unpaid orders and clear gross-versus-net labeling.
3. **Free download ignores publication status.** `app/api/downloads/free/route.ts` fetches status but only checks is_free. A known draft/private beat ID can yield a master. Require a downloadable published state.
4. **Paid upload limits are client-side.** Presign only authenticates; it does not enforce producer role, beat ownership, subscription, file size, or entitlement. Beats/templates/promo RLS allows owner writes without tier checks. Implement authoritative quota and entitlement checks, including direct database access.
5. **Review purchase verification is bypassable through direct writes.** The permissive original `Buyers can leave reviews.` policy survives the table rename; migration 015 drops different policy names. Permissive policies combine with OR. Its new insert policy checks purchase but does not bind reviewer_id to auth.uid(). Restrict both ownership and paid entitlement in one correct policy.
6. **Message RLS does not require membership on INSERT.** Migration 005 checks only sender_id, allowing direct insertion into another known conversation. The API has a membership check, but direct Supabase access bypasses it. The API also trusts recipient_id for notifications even with an existing conversation, enabling unrelated notification spam.
7. **Offers are not an end-to-end purchase flow.** Accepted offers link to `/checkout?offer_id=...`, but no checkout page exists there and the checkout API does not consume offers. Buyer counters fail the producer-only UPDATE policy. Notifications link to missing `/dashboard/offers`. Define a role-aware transition model and server-priced accepted-offer checkout.
8. **Errors are often treated as success/empty state.** Profile queries reference an email column absent from committed schema, featured-producer homepage queries join owner-private settings, and several writes ignore Supabase errors. This can hide failures rather than surface actionable states. Avoid opening bank-bearing settings for public reads; expose a safe public producer projection.
9. **No application-level throttling was found** on uploads, expensive processing, offers, comments, leads, notification generation, or payment initialization. Several list endpoints lack pagination. Add bounded inputs, deduplication, throttling and pagination appropriate to each operation.
10. **Operational setup is incomplete.** `.env.example` omits the Cloudflare R2 variables required by `lib/r2.ts`; ffmpeg on Linux assumes a system binary despite ffmpeg-static being installed. Queue schedules are not declared in vercel.json. Verify external job configuration before relying on it.
11. **Production diagnostics are removed.** `next.config.js` removes all console calls in production, including the console.error paths used for financial failures. Establish structured server logging and alerts; preserve errors at minimum.
12. **Migration replay has another ordering hazard.** Migration 007 adds the active-only status constraint before converting existing published rows. It can fail on data containing published rows. Migration/setup paths need a non-destructive reconciliation plan, not a bulk replay.

## Existing strengths

Checkout derives prices server-side and recomputes discounts; payment webhooks use raw-body HMAC with timing-safe comparison; authenticated download routes check buyer and completed status; upload keys are normally constructed under the authenticated user's prefix; cron/internal authentication has production checks; money arithmetic uses atomic RPCs for individual balance mutations; private and public R2 assets are separated. The architecture has useful foundations, but the gaps above cross these protections.

## Validation and limits

- Read repository structure, application routes, core client/server modules, SQL policies/functions, payment/media/license flows, configuration and maintenance scripts. Findings are static source evidence, not exploit attempts against a live service.
- Attempted TypeScript with `./node_modules/.bin/tsc --noEmit --incremental false`: unavailable because dependencies are not installed.
- Attempted lint with `npm run lint -- --no-cache`: unavailable because npm is not on PATH.
- Did not install packages, execute seed scripts, launch the app, run a production build, apply SQL, invoke APIs, create payments, send emails, or touch database/storage data.
- No automated application test suite or CI workflow was found in the tracked source inventory. Dependency security review was limited to the pinned framework and its cited advisory; it was not a full lockfile vulnerability audit.
- RLS and schema behavior must eventually be checked against read-only live metadata or an isolated disposable database, with explicit authorization. Do not use the existing reset scripts to establish that environment against production.

## Recommended implementation order

1. Preserve data: quarantine destructive setup paths and verify recovery arrangements without running resets.
2. Close financial RPC access, subscription self-upgrade, cross-account asset operations, and direct-write RLS bypasses.
3. Make order settlement, exclusive ownership, split allocation, and payout reconciliation atomic and retryable; add isolated failure/concurrency tests.
4. Reconcile schema/query mismatches and repair watermark queue, payout settings, license snapshots and downloads.
5. Complete offers and subscription lifecycle, then repair ownership cache/analytics and add operational safeguards.
6. Build additional product features on top of the stabilized flows.
