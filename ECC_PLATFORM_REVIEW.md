# BeatToday — ECC platform improvement review

Date: 2026-11-01  
Checkout reviewed: `84203f6` on `dev`  
Methods: ECC Product Lens (founder review and feature prioritization), Production
Audit, and a scoped Click-Path Audit of message sending and unread alerts.

**Production-readiness assessment: 68/100 — suitable for a controlled beta;
strengthen release verification and operational recovery before expanding use.**
This is an engineering triage judgment from local evidence, not a certification,
security incident finding, usage score or product-market-fit measurement.

## Product direction

BeatToday combines a beat-licensing marketplace with a PRO studio business
workspace. Producers can attract artists, sell beats, receive session enquiries,
reserve rooms and confirm scope through versioned shared agreements. Artists can
find music and producers, discuss custom work and track sessions/projects.

The strongest product hypothesis is that an artist can discover a producer and
complete real work with them in one place. The next phase should make this journey
routine and measurable. There is no usage, retention or revenue dataset in this
review from which to conclude product-market fit or predict revenue growth.

Keep the near-term scope around two outcomes:

- Marketplace: discover a beat → choose a license → pay → obtain the correct files.
- Studio: enquire → request a session → producer reserves → artist accepts the
  exact agreement → session happens → artist returns for more work.

The booking/agreement foundation already exists. A complete revision-and-file-
delivery product is a later expansion; agreement text describing deliverables is
not the same as an implemented delivery workflow.

## What is already worth preserving

- Atomic marketplace settlement and regression tests around money, licenses,
  exclusive reservations and provider retries.
- Booking quotes are separate from wallet balances and actual payments.
- Explicit publication, PRO gating, room conflicts and immutable accepted terms.
- Realtime subscriptions with catch-up, duplicate-event handling and retained
  message drafts after failure.
- Data-preservation instructions and quarantined destructive historical SQL.

Do not replace these foundations during a redesign. Build on them.

## Findings grounded in current code

### 1. Release checks need to become automatic — high priority

Evidence: `package.json` has test/typecheck/build scripts and seven test files,
but the checkout has no `.github/workflows` directory or committed browser E2E
suite. Prior browser evidence lives in temporary, ignored fixtures. External
hosting checks may exist, but were not inspected during this review.

Impact: a change can build successfully while breaking the actual artist or
producer journey. The prior booking-button problem demonstrated this distinction.

Next step: commit a CI workflow for isolated tests, type checking and a build with
dummy credentials. Add repeatable browser scenarios for producer setup/publication,
artist sign-in return, request/reservation/confirmation, chat delivery, and beat
purchase/download through provider test doubles or an isolated test environment.
Never run these scenarios against customer accounts or the live database.

Acceptance: a deliberate regression in one critical journey fails a pull request;
no production credential is needed for the automated suite.

### 2. Health and operator recovery are incomplete — high priority

Evidence: `app/api/health/route.ts:3` always returns HTTP 200 with a timestamp.
`lib/payments.ts` preserves settlement failures in `payment_reconciliations`, and
cron handlers log failed work. No reconciliation operator page was found under
`app/dashboard`, and no exercised restore/incident runbook was found in the
reviewed release documents. Previous notes explicitly distinguish data snapshots
from a full disaster-recovery backup.

Impact: the site can look healthy while delivery, settlement or a background job
needs intervention. Correctly preserving a failed payment is only part of recovery.

Next step: keep cheap liveness, add a separately controlled readiness check and
job-age/error visibility. Document who investigates an unresolved payment, how
code is rolled back and how database/assets are restored. Exercise recovery in
an isolated copy. Start with a read-only exception dashboard; any retry or money
operation needs its own authorization and audit trail.

Acceptance: an intentionally failed test delivery appears in the operator view;
a stale job causes a meaningful alert; an isolated restore is demonstrated.

### 3. Reading chat does not clear the corresponding alert — medium priority

Evidence: `app/api/messages/route.ts:40` updates `messages.is_read` only.
`app/api/notifications/route.ts:34` counts unread `notifications` rows with
`type='new_message'`. `MessageThread.tsx` emits a notification-refresh event, but
that event only reloads the notification records.

Static trace: open a message through the inbox → the message is marked read →
notification counts refresh → the separate message-alert record is still unread.
An alert clicked directly in the notification dropdown can be marked read through
a different path, which explains why the two entry paths can disagree.

Next step: define one unread contract. Either derive the message badge from unread
received messages, or reconcile relevant alerts only when their conversation is
actually read. Keep general notification read state independent. Include races
where a new message arrives while earlier messages are being marked read.

Acceptance: reading from either the inbox or an alert gives the same final badge;
a newer unread message is never cleared accidentally.

### 4. Send retries need request-level idempotency — medium priority

Evidence: `app/api/messages/route.ts:113` inserts a new message for each POST.
The thread deduplicates by returned row ID, but has no stable send-request key.
Conversation-creation race recovery does not make message insertion idempotent.

Static failure scenario: the server commits a message but the response is lost →
the client retains the draft → retry sends another POST → a different message ID
is inserted. Socket-echo deduplication cannot merge these two saved records.

Next step: assign a stable client request ID to each send attempt and enforce
uniqueness scoped to the authenticated sender. Reuse it on retry, and create a
new ID for an intentional new message. This likely requires an additive migration,
which must be reviewed and separately approved before application.

Acceptance: commit-then-timeout followed by retry produces one stored message and
one alert; intentionally sending the same text twice still produces two messages.

### 5. Calendar reads can omit relevant bookings at scale — medium priority

Evidence: `lib/studio/bookingData.ts:24` takes 200 bookings ordered by start time
descending. `BookingDashboard.tsx:29` filters that already-limited list to the
selected day. Artist history also stops at 200 records.

Impact: enough later bookings can push an earlier upcoming day outside the loaded
set, so the UI may look empty even though a booking exists. Database slot checks
still protect time allocation; this finding concerns display completeness.

Next step: fetch the visible calendar date range directly, load history with
pagination, and obtain pending-request counts separately. Preserve all history.

Acceptance: create over 200 fictional future bookings; every selected date shows
its relevant sessions and requests remain actionable.

### 6. Routine studio administration is still too limited — product priority

Evidence: booking commands support creating and hiding services, but not editing
service details or a coordinated rescheduling flow. The existing booking audit
also lists these as limits. Room allocation, agreement confirmation and booking
history already provide useful foundations.

Next step: add service editing for future requests; retain existing booking
snapshots. Then add proposed rescheduling that requires the other party's response
and rechecks availability atomically. Show what happens to the linked agreement
when its session time changes. Add reminders after this state model is reliable.

Acceptance: a producer can correct a price without hiding/recreating a service;
a move cannot overwrite an accepted schedule or displace another artist silently.

### 7. PRO's public value proposition is inconsistent — quick product win

Evidence: `app/dashboard/subscription/page.tsx:53` mentions studio bookings,
projects and shared agreements. The public PRO feature list in
`app/pricing/page.tsx:78` does not mention the studio workspace.

Next step: use a shared plan-capability definition for public pricing, upgrade
screens and eligibility messages. Explain booking and agreements clearly, without
claiming that deposits, automated file delivery or revisions already exist.

Acceptance: visitors can understand why a studio producer would upgrade before
creating an account; public and signed-in feature lists agree.

### 8. Growth decisions need a measurable funnel — discovery priority

Evidence: sales/play counters exist, but no structured studio activation or
booking-conversion event instrumentation was found in the reviewed code.

Next step: record privacy-conscious events for studio setup completion,
publication, booking-page visits, requests, producer response, agreement acceptance,
session completion and repeat booking. Establish a baseline before setting targets.
Do not log message contents, private briefs or payment credentials as analytics.

Useful metrics: median time from studio creation to publication; booking-page to
request conversion; median producer response time; request-to-confirmation rate;
cancellation rate; repeat studio bookings; beat checkout-to-delivery success.

Acceptance: one weekly report explains where artists/producers abandon the journey.
No additional paid analytics subscription is required to define this contract.

## Feature prioritization after the reliability work

ECC Product Lens uses impact × confidence ÷ effort, each input scored 1–5.
These are planning estimates from code and prior user feedback, not market data.
Safety and correctness dependencies take precedence over the numeric ranking.

| Candidate | Impact | Confidence | Effort | Score | Next concrete action |
|---|---:|---:|---:|---:|---|
| Clear, consistent PRO studio positioning | 4 | 5 | 1 | 20.0 | Share capability copy across both plan pages |
| Service editing that preserves booked terms | 4 | 5 | 2 | 10.0 | Specify which fields affect future requests only |
| Studio activation/conversion measurement | 4 | 4 | 2 | 8.0 | Define event names, privacy rules and a baseline report |
| Rescheduling with mutual confirmation | 5 | 4 | 3 | 6.7 | Define states, room locks and agreement implications |
| Booking reminders | 4 | 4 | 3 | 5.3 | Tie scheduled reminders to current booking version |
| Custom enquiry → quoted project conversion | 4 | 4 | 3 | 5.3 | Link the brief to a producer proposal without retyping |
| Versioned delivery, revisions and acceptance | 5 | 3 | 5 | 3.0 | Validate demand with active producers; define private assets |
| Online studio deposits | 5 | 2 | 5 | 2.0 | Define cancellation/refund/reconciliation rules first |

## Recommended sequence

**First reliability batch:** automatic release checks, unread-state consistency,
send idempotency, visible-range calendar reads, and basic operational recovery.
These protect trust before increasing traffic.

**Next product batch:** shared PRO positioning, service editing, funnel measurement,
and mutually confirmed rescheduling. This makes the existing workspace useful
for routine studio business without extending the money pipeline.

**Later:** reminders and enquiry-to-quote conversion; then versioned deliveries,
revision requests and explicit completion acceptance when usage supports that
investment. Implement deposits only after the lifecycle and reconciliation rules
are agreed. The existing studio quote must never be presented as paid funds.

## Evidence and limits

- Inspected local `dev` at `84203f6`, domain/safety instructions, package scripts,
  release notes, API/payment/job boundaries, plan pages and studio/chat components.
- Ran the existing suite with the bundled Node runtime: **63 tests passed, zero
  failed**. The test suite uses isolated in-memory data; dummy provider variables
  pointed to `http://127.0.0.1:9`. The old temporary Node installation was absent;
  no runtime or package was installed to perform this review.
- No production build, browser session, network probe, live SQL, provider action,
  migration, customer message or storage maintenance was performed in this review.
- Historical rollout notes are background, not verification of today's production
  state. No live service health, schedules, data exposure or deployed version was
  re-established here. Customer research, usage/revenue analytics, real provider
  test-mode integration and independent concurrent Postgres tests remain missing.
- Only this review document was created. Application code, configuration and the
  database were left unchanged. No hooks, agents or plugin configuration were
  installed, and no source code was uploaded to an audit service.

## Specific next action

Start with the reliability batch above. Its first implementation should establish
CI and reproduce the unread-badge and calendar-limit scenarios in durable tests.
That creates a safer base for service editing and rescheduling. This review does
not authorize any database migration or live-data operation.

## Implementation follow-up — 2026-11-01

The user authorized the first reliability work plus a platform-wide security and
payments audit. Local changes add CI, chat read/alert reconciliation, stable send
keys with an atomic authenticated send function, selected-day calendar queries
and pagination, and protected read-only operational checks. The specifically
approved messaging migration was applied and verified separately; application
changes still require deployment. See [PLATFORM_SECURITY_AUDIT.md](PLATFORM_SECURITY_AUDIT.md)
and [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md). Full browser journey coverage,
required deploy gates, production monitor configuration and a recovery drill remain
open; the product roadmap above has not been implemented by this batch.
