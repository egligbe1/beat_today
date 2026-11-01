# BeatToday platform security and payments audit

Implementation follow-up: [RISK_REMEDIATION_STATUS.md](RISK_REMEDIATION_STATUS.md)
records the subsequent fixes, deployment evidence and remaining configuration.

Date: 2026-11-01. Baseline: `84203f6` on `dev`; remediation is in this working tree.
Method: ECC Security Review, Verification Loop and the earlier ECC platform review.
This report distinguishes repository findings, isolated tests and narrowly scoped
live verification of the specifically approved messaging migration.

Assessment: the core money pipeline has useful atomicity and access protections,
but refund/dispute recovery and operational readiness remain significant gaps.
This is not a penetration-test certification or a claim that production is secure.

## Changes implemented

| Area | Confirmed finding | Remediation / evidence |
|---|---|---|
| Upload entitlements | The WAV plan check compared the extension before lowercasing it. Uppercase WAV passed this endpoint check. Existing database entitlement triggers still protected saved beat fields. | Normalize first; validate extension/MIME pairs, integer sizes and purpose allowlists. Test uppercase WAV, mismatched image types and prototype keys. |
| Upload signatures | An isolated call to the actual S3 signer showed `content-length;host` only. The approved MIME could be changed during PUT. | Sign `content-type` explicitly, along with the already signed size. Test the real presigner with dummy credentials and no storage request. Binary content validation remains open below. |
| Browser boundaries | No baseline browser security headers; a cross-site mutation without Origin was not rejected using Fetch Metadata. | Add nosniff, frame protection, referrer policy and a baseline CSP. Reject `Sec-Fetch-Site: cross-site` when Origin is absent; keep signed webhook/cron paths exempt. This CSP does not yet restrict scripts. |
| Session handoff | Unbounded and untyped JSON; the endpoint unnecessarily returned session credentials. | Stream-limit input, validate token shape/length, return minimal success with `private, no-store`. Existing clients only inspect response success. |
| Request resource limits | Several sensitive handlers buffered entire requests before checking size. | A shared streaming byte limit now protects session, upload, checkout, chat, notifications, payout settings, studio commands, watermark and signed-job bodies. Existing social endpoints still need consistent adoption. |
| Bank verification | Caller needed only sign-in; input was concatenated into the provider URL; no request limit or timeout; raw error details returned. | Require producer role, validate account/bank input, encode parameters, limit authenticated requests, bound upstream time and sanitize errors. No real account verification or recipient creation was run as a test. |
| Payout setup | Unbounded recipient payloads and provider waits; raw errors; manual-review wallet save errors were ignored. | Validate method/name/account/network, cap input and requests, enforce provider timeout and check saves. Upserts continue to change only recipient fields, never balances. |
| Exchange rates for charges | Checkout/subscription initialization could silently use the fixed fallback GHS rate after an upstream failure. | Charging paths now require a valid provider rate and fail before creating the checkout/subscription payment when unavailable. Display-only callers retain the fallback. Provider fetch is bounded. Isolated outage/invalid-rate tests cover this boundary. |
| Paystack webhook | Signature authentication existed, but input buffering was unbounded. | Keep raw-body HMAC SHA512 and constant-time comparison, add bounded UTF-8 input and tests for missing keys, malformed signatures and tampering. |
| Payment verification | Public provider verification could be repeatedly invoked without an application limit. | Add an IP-based perimeter limit. Verified settlement remains authoritative and idempotent; the endpoint remains accessible to payment redirects. Proxy trust and edge protection still need deployment verification. |
| Downloads | Filenames escaped quotes but retained header controls; purchased signed-link responses lacked an explicit private no-store directive. | Sanitize filename controls/separators, retain Unicode through RFC 5987, add private no-store and validate purchase IDs. Buyer/order/license/asset ownership checks remain. |
| Messaging read state | Reading through the inbox left separate message alerts unread. | Reconcile alerts by exact message ID, recipient and conversation; clear legacy alerts only after no unread received messages remain and exclude alerts arriving during the request. Tests retain other users, other conversations, own messages and newer alerts. |
| Messaging send retries | A committed send followed by a lost response could create duplicate messages/alerts. | Stable send keys in all three sending UIs; authenticated atomic `send_message_once`, sender-scoped uniqueness, database-side request limits and no fallback insert after an RPC error. Specifically approved migration applied and verified; details below. |
| Booking calendar/history | Filtering the latest 200 rows could hide an earlier selected date. | Query studio-local date bounds before pagination; separate request counts/history pages; timezone and midnight DST tests. A real Supabase-query test uses 350 later fictional bookings plus 32 selected-day sessions. |
| Releases | No committed CI workflow. | Add pinned-action CI for tests, lint, types, isolated build and a high/critical dependency-advisory gate. It is local until pushed; branch protection and hosting deploy dependencies are not configured by this file. |
| Operations | Health endpoint was liveness only. | Keep liveness; add separate secret-protected read-only readiness/configuration and job-failure counts. Add an operator runbook. The new endpoint still requires a configured production operator secret. |
| Privacy accuracy | The policy claimed only four bank digits were stored and named Vercel as the host. Source retains full producer payout details. | Correct the payment-data description and listed infrastructure providers. This factual correction does not substitute for a full legal/privacy review. |
| Accidental secrets | Environment exclusions covered only `.env*.local`. | Ignore all `.env*` except the tracked example. Redacted pattern scans found no matching credentials in tracked files or the checked Git history. This cannot establish that every credential is safe or has never leaked. |

## Money and authorization boundaries reviewed

| Boundary | Repository evidence and isolated verification |
|---|---|
| Checkout pricing | `prepare_checkout` derives prices, promotions and accepted offers on the server; client totals do not authorize payment or wallet credit. |
| Settlement | `settle_order` binds the saved reference, collected amount and currency; locks the order; commits wallet/ledger/license/delivery records atomically; marks completed last. Repeated verified callbacks do not double-credit. |
| Exclusives | Order-bound reservations and settlement conflict checks preserve ownership. A late conflicting charge goes to reconciliation instead of taking a second artist's entitlement. |
| Subscriptions | Saved reference, tier and expected amount authorize activation. Callback URL parameters do not grant a tier. Expired or missing paid periods do not confer paid access. |
| Payout reservation | `begin_payout` reserves wallet funds atomically and saves a stable provider reference/payload. Application code does not read-modify-write balances. |
| Payout completion | `finish_payout` handles signed success/failure/reversal transitions and avoids restoring funds twice. An ambiguous provider timeout remains processing for reconciliation. |
| Financial permissions | Migration 039 and the marketplace tests cover protected billing fields and restricted financial functions. Today's broad live grants were not re-audited. |
| Private delivery | Completed buyer ownership, licensed stems access, immutable asset snapshots and producer-owned keys gate private downloads; license PDFs require the buyer. Signed URLs are bearer links until expiry. |
| Studio permissions | Request-scoped commands derive the actor from `auth.uid()`. Accepted agreement versions and booking snapshots are immutable; room allocation uses database conflict/locking rules. Studio quotes do not credit marketplace wallets. |
| Messages | Participants authorize reads/receipts. The new function derives sender identity, validates membership, restricts anonymous execution and applies its own limiter so direct authenticated RPC calls do not bypass the API limit. |
| Jobs/media processing | QStash signature/body/canonical URL verification fails closed. Watermark processing uses owned private keys, bounded source sizes, temporary files, argument-based process execution and a timeout. |

The payment tests use isolated PostgreSQL (PGlite). They are valuable regression
checks but do not prove behavior under independent concurrent production sessions
or an actual provider outage, transfer or chargeback.

## Remaining findings, ordered by priority

1. **High — refunds/disputes have no accounting recovery workflow.**
   `app/api/webhooks/paystack/route.ts` handles successful charges and transfer
   outcomes, but acknowledges other signed events without a refund/dispute
   workflow. A later refunded/disputed charge can leave seller earnings available
   or already paid. Define event identity, case state, pending/available/already-paid
   treatment, reserves and reviewed adjustment records. Do not subtract balances
   blindly or delete purchases. Payment-exception records also lack a resolution
   state and operator action history. Implement these together before scaling.
2. **High operational gap — recovery is documented, not exercised.**
   No current restore drill, independent off-platform database/asset backup evidence,
   tested operator escalation or end-to-end provider recovery exercise was obtained.
   Configure the new readiness secret and monitoring, then exercise recovery in an
   isolated copy. A successful schema migration or liveness response proves none
   of those controls.
3. **Medium — file content is still trusted after presigning.**
   Extension, MIME, ownership and signed size do not establish that uploaded bytes
   are a valid image/audio/archive. Introduce bounded verification/quarantine before
   publishing or delivering files, ZIP expansion limits where archives are opened,
   and per-account storage quotas. No uploaded or purchased asset was removed.
4. **Medium — consistent abuse protection remains incomplete.**
   Follow/like toggles, public handle/catalog lookups, slot discovery, review
   refreshes and some offer/promo/social handlers lack consistent limits/body caps.
   Centralize this without breaking public discovery. Verify which forwarded
   address the hosting edge authenticates before treating an IP limit as strong
   identity. Supabase signup/sign-in CAPTCHA and service-side auth limits were not
   inspected or changed.
5. **Medium — dependency advisory remains.**
   An npm bulk-advisory lookup of 547 locked package/version entries reported
   `minimatch` 3.1.5 and 10.2.6, moderate glob-amplification DoS,
   [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
   Lockfile parents are lint/type-analysis tooling; no direct application use was
   found. No high/critical advisory was returned in that response. Do not globally
   override the older CommonJS API with version 11; upgrade the owning toolchain
   with compatibility checks. This is not a guarantee against undisclosed issues.
6. **Medium — browser journey coverage/deploy gating remains incomplete.**
   CI exists locally and the regression suite grew, but no durable full browser
   suite or required GitHub check/Render deployment gate was configured. Add
   isolated artist/producer journeys and Paystack test doubles; do not use customer
   accounts to test them.
7. **Hardening / service limitations.**
   The CSP currently protects framing/base/object embedding, not script execution.
   Leaked-password protection remains disabled on the user's Free setup; no paid
   plan was purchased. Broader privacy claims about retention, analytics, rights
   and notifications need a separate policy review against actual operations.
   Job counts do not prove schedule execution or detect every stuck queue; the
   exception table counts historical records because it has no resolution field.

## Approved messaging migration: live verification

User explicitly approved **only**
`supabase/migrations/20261101113000_idempotent_messages.sql` during this work.
Applied through the Supabase plugin to **BeatToday**, project
`chutqhuzargkpcmccfbg`. Supabase recorded version **20261101105709**, name
`idempotent_messages`; the local filename remains the specifically reviewed file.
Do not bulk-apply the migrations directory to reconcile these identifiers.

Applied file SHA256:
`fdb9f5b9f3506583245075f17bb77c286eb5e83fe4646b0139d1c2805e3de089`.

Preflight inspected relevant columns/indexes, RLS and direct-insert grants, and
confirmed the existing rate limiter. After application:

- Message/conversation/notification counts were unchanged: 6 / 1 / 9.
- Existing messages retained null request IDs; no historical backfill ran.
- All three tables retained RLS. Authenticated message INSERT remained revoked.
- Anonymous function execution was false; authenticated execution was true.
- The unique sender/request partial index and fixed search path were present.
- A function call with no user identity was rejected before any write.
- No customer message, notification, payment, payout, user or asset was created as
  a live test. Wallets and financial tables are outside this migration.

The post-DDL security advisor reported the expected authenticated-definer warning
for `send_message_once`. Its deliberate public API is protected by identity,
participant checks, database limits and explicit execute grants. Existing GraphQL
schema-discoverability warnings are not proof of row disclosure; public projections
and private RLS predicates must be assessed per object. Five RLS/no-policy notices
refer to service-only internal tables and do not justify granting browser access.
No broad permission changes were applied in response to these notices.

Advisor references:
[authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[anonymous GraphQL discovery](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed),
[authenticated GraphQL discovery](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed),
[RLS with no policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verification and release limits

- Isolated test suite: **77 passing, zero failed**.
- Lint: zero warnings/errors; type check and production build passed.
- Local HTTP smoke checks passed for liveness/security headers, operator readiness
  authorization and missing configuration, cross-site requests, and malformed/oversized
  session input. The temporary local server was stopped after verification.
- Lint/type check and production build use installed tooling and dummy credentials;
  Supabase points to `127.0.0.1:9`. No production application flow was exercised.
- Secret-pattern scan: 626 historical blobs examined, with a 2 MB per-blob cap,
  plus current tracked files. No matching secret was printed or uploaded.
- Package names/versions only were sent to the npm advisory service; source code
  and customer data were not uploaded to an external audit service.
- Live access was limited to the approved migration's preflight, application,
  postchecks and metadata/advisor verification. No general live data audit, reset,
  maintenance, balance adjustment, storage cleanup or other migration occurred.
- Application/CI changes remain local until committed/deployed. The live schema
  addition is backward-compatible with the previous application.
- New app code defaults to atomic messaging after deployment. Setting
  `MESSAGE_IDEMPOTENCY_ENABLED=false` is an emergency compatibility switch that
  restores the older non-idempotent send path; it is not the normal configuration.

Primary references checked:
[Paystack webhook signatures and retries](https://paystack.com/docs/payments/webhooks/),
[Supabase changelog](https://supabase.com/changelog), and installed SDK source/types
for the upload signer and query behavior.
