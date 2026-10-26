# Studio workspace implementation — 26 October 2026

Current direction: the studio now starts with booking and availability. See
[BOOKING_BUILD_STATUS.md](BOOKING_BUILD_STATUS.md) for the booking-first release.

The first implementation connects PRO studio setup, shared artist/producer
projects, two-party agreements, milestones and project conversations. It is the
agreement/project foundation in STUDIO_MANAGEMENT_PLAN.md, not the whole studio
business product. Revision `3202cd2e4d0b68c354df457149283b46fd4075f5` is live
on Render (deployment `dep-dbfo8brbc2fs7398r7d0`); its production build passed.

## Working features

- Producer Studio Workspace and shared My Projects routes for artists/producers,
  including desktop navigation and mobile entry points.
- Active-PRO studio setup and artist-linked project creation by registered handle.
- Immutable agreement terms, SHA-256 content fingerprints, version history,
  explicit producer confirmation on publishing, artist acceptance/change requests,
  stale-version guards and downloadable multi-page agreement PDFs.
- Accepted terms remain active while a new amendment awaits artist confirmation.
  Server-captured party names, project details and milestone snapshots are retained.
- Milestone planning before publication, producer completion tracking after
  acceptance, project discussion, activity history and producer stage updates.
- Server-derived actor identity, scoped RLS and atomic database actions. No direct
  browser table writes. New business requires PRO; accepted projects remain usable
  after expiry. Studio agreement values do not affect payments or earnings.

## Database deployment

User explicitly authorized testing and applying the studio changes during this
build. Only `20261026164028_studio_workspace.sql` was applied via Supabase MCP.
It adds five tables, a private schema, narrowly scoped functions, indexes and RLS.
No reset, historical migration replay, data deletion or media maintenance occurred.

Immediately before/after, all existing records in 67 application/auth/storage
tables were compared. No original rows or field values changed. A private local
snapshot is retained outside Git. Supabase migration history records the new
version. All five new tables have RLS; anon cannot read them or call the RPC;
authenticated users have SELECT under participant policies and no direct writes.
The public RPC uses SECURITY INVOKER; private write logic derives auth.uid().
Security advisor added only five authenticated GraphQL schema-discoverability
notices, with scoped RLS still enforced; no new definer/search-path warning.

## Verification

- Isolated PGlite tests cover PRO gating, participant isolation, denied direct
  writes, exact-version confirmation, immutable history, accepted amendments,
  frozen milestones, replay idempotency and expiry continuity.
- Pure tests cover exact minor-unit conversion and invalid prices. A long-terms
  agreement renders as a multi-page PDF with confirmation evidence.
- All 43 tests passed, including existing marketplace and financial regression
  tests. The production build and TypeScript checks passed.
- Build uses dummy credentials and an unused loopback Supabase URL.
- Local visual checks used fictional data at phone and desktop breakpoints.
  The temporary preview route was removed before deployment; fixtures remain in
  ignored scratch files. No live users were impersonated to create test projects.
- PGlite tests do not simulate separate concurrent Postgres backend connections.
  No real payment, studio agreement acceptance, email or asset upload was triggered
  as a production smoke test.

## Next implementation slices

Versioned private project files, timestamped audio feedback, grouped revision
rounds, version approval and final-delivery manifests come next. Room calendar allocation and booking intake are covered by the booking-first
release. Engineer scheduling, broader client/team management and studio-specific
payments/receipts/refunds remain separate implementation work. New database
changes still require review and explicit authorization for the specific migration.


Post-deployment smoke checks: the unauthenticated studio command returns HTTP
401; the public homepage returns HTTP 200 with a populated catalog and no
application-error page. No production test projects or agreements were created.

The signed-in production producer page was also opened read-only and verified:
Studio Workspace/My Projects navigation and the real studio-setup form render
correctly. No setup form was submitted and no test customers were notified.
