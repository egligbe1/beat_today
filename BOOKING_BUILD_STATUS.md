# Booking-first studio release — 26 October 2026

The studio entry point is now the calendar and booking inbox. The earlier project
and agreement implementation remains intact and follows a reserved session.
Application deployment is in progress; the verified revision will be recorded here.

## Working journey

1. Producer creates a studio, rooms, weekly same-day opening hours and fixed-duration
   session services (30–480 minutes). Per-service buffers apply before and after.
2. Producer publishes a booking page and sets advance notice/booking horizon.
   A Book Studio link appears on the public producer profile when services are active.
3. Signed-in artist chooses a service, studio-local date/time and session notes.
   The request snapshots the server-side service quote; it does not hold a slot.
4. Producer reserves the request. Room allocation is checked transactionally, and
   one linked project is created. Repeating reservation does not duplicate projects.
5. The time is held for up to 24 hours, or until session start, whichever is sooner.
   Producer prepares the agreement with the booking details and quote prefilled.
6. Artist agreement acceptance confirms the reserved session atomically. Expired
   reservations need producer renewal; a cancelled booking cannot be resurrected
   by accepting an old agreement. Existing accepted amendments remain supported.
7. Both parties see booking history and a link to the agreement/project. Producers
   can decline requests, cancel reservations with a reason, and mark ended sessions
   complete. Artists can withdraw pending requests. Records are retained.

Manual producer bookings use a registered artist handle and the same reservation /
project workflow. Rooms can be scheduled independently. Blocked time is private;
unblocking marks the record inactive rather than deleting it. Changing opening
hours or hiding a service does not erase existing bookings.

## Integrity and access

- All allocation writers lock the room before updating booking state. Acceptance
  rechecks expiry under the same room lock. Direct browser table writes are denied.
- Availability is a bounded projection of free times; it never returns artist
  identities, booking notes or reasons for blocked time.
- Direct SELECT on new tables is scoped by owner/participant RLS. Anon has no table
  reads or write RPC access. Only the safe catalog/availability projections are public.
- Actor identity comes from auth.uid(), not a caller-provided account ID.
- Publishing/new bookings require active PRO. Expiry closes public intake and
  preserves existing bookings/projects/history. No paid infrastructure plan changed.
- The previous studio command implementation and all old orders/licenses/wallets
  remain intact. Booking prices are quotes; this release does not collect money,
  issue refunds or credit earnings. Agreement amounts are not payment receipts.

## Authorized migration and preservation checks

The user approved applying only the booking migration. Supabase recorded
`20261026171617_studio_bookings`. It adds six scheduling tables, indexes, RLS,
private functions, safe public wrappers and an agreement-confirmation trigger on
studio_projects. Application of the migration does not update existing rows.

A private pre-change snapshot captured all 72 existing application/auth/storage
tables. Before/after comparison found no changed original rows or field values.
No reset, legacy migration replay, asset deletion or financial operation occurred.
The new six tables have RLS. Live checks confirm anon cannot read bookings or call
the write command, and authenticated users cannot directly insert bookings.
Security advisor adds only six authenticated GraphQL schema-discoverability notices;
no new definer/search-path or open-table advisory was introduced.

## Verification and limits

- 55 isolated tests pass, including existing finance/marketplace tests and booking
  tests for configuration, publication, privacy, authoritative prices, competing
  requests, buffers, manual bookings, independent rooms, blocks/unblocks, agreement
  confirmation, expiry/cancellation rollback, history and PRO-expiry continuity.
- Booking labels distinguish repeated daylight-saving times by timezone offset.
- Local visual checks cover desktop calendar/request views and mobile settings;
  fictional preview fixtures remain in ignored scratch files, outside deployment.
- Production build uses dummy credentials and an unused loopback Supabase URL.
- PGlite tests do not simulate independent concurrent Postgres backend connections.
  No production user was impersonated to create test sessions, messages or agreements.
- Current capacity checks cover rooms. Staff/engineer assignment, equipment counts,
  guest-client booking, overnight opening windows, online deposits, booking reminder
  emails and advanced calendar sync are separate implementation work.
- Dashboard/history queries are bounded to 200 bookings/blocks; older records are
  retained. Pagination and larger-scale calendar reporting are subsequent work.
