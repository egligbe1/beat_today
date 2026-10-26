# Booking functionality audit — 2026-10-26

The earlier public-profile check established that a booking button rendered; it
was not sufficient evidence for the complete booking journey. This follow-up
examines producer setup, artist discovery/sign-in, free times, requests, producer
reservation, agreement versions and confirmation.

## Findings and changes

1. **Sign-in abandoned booking intent.** Password login always went home or to the
   dashboard; Google did not forward the booking destination. Login, signup,
   OAuth callback, onboarding and authenticated-login redirects now share a
   validated local return path. Session details are saved in session storage when
   leaving to sign in and restored only against current services, booking dates
   and available slots. Notes survive; a stale time is never restored as selected.
2. **Setup was hard to finish.** Private studios defaulted to an empty calendar,
   publication appeared before configuration and every action said only “updated”.
   Setup now opens first, shows four readiness steps, orders configuration before
   publication, selects newly added rooms and explains the next action. Publication
   is unavailable until an active service fits its room hours including both
   buffers. No settings, prices or publication are chosen on the producer's behalf.
3. **A published profile needed an unnecessary extra click.** Its header now opens
   the booking flow directly; the producer's own button opens management. Private
   studio profiles retain the honest contact/setup state.
4. **A closed day looked like a dead end.** Artists can explicitly search the next
   seven days, bounded by the producer's booking horizon. Loading errors have a
   retry action. Invalid calendar dates are rejected at the availability endpoint.
5. **A taken time remained selected after submission failure.** Failed requests
   now clear the selection and reload free times, retaining notes. Double submission
   and submission while times are loading are disabled. Existing-request history
   remains reachable after an ambiguous network failure.
6. **Expired holds looked live.** Booking lists and projects now distinguish expired
   reservations, explain recovery and prevent agreement acceptance until renewed.
   Producers can renew from the project if the start is still future. Completion
   is offered only after a confirmed session has ended. Live counts exclude expired
   holds; status updates while the page remains open.
7. **Consent could carry across a newly proposed agreement.** The checkbox is now
   tied to the exact agreement ID. A new version requires fresh acceptance, even
   when project data refreshes while the artist is reading.
8. **Requests and agreements stayed stale.** Visible calendar/request, artist
   history and project views refresh every 30 seconds and on returning to the tab.
   Refresh pauses during setup, manual booking and agreement composition/actions.
9. **Some timezone blocks could disappear from the dashboard.** The bounded block
   history query includes a one-day lookback for studios east of UTC. Authoritative
   slot conflict checks remain in the database.

## Verification

- 59 isolated automated tests: the existing finance, marketplace and studio suites,
  plus return-path safety, setup duration/buffers, bounded available-day search,
  calendar-date validation and expiry boundaries.
- Browser journey used real production components and the existing booking/core SQL
  functions in an in-memory PGlite database behind a temporary local HTTP fixture.
  Only fictional producer/artist accounts were used. Browser interactions covered:
  room creation, weekly hours, service creation, explicit publication, finding the
  next available day, request submission, producer reservation, publishing exact
  terms, artist acceptance and a CONFIRMED entry in artist history.
- A second fictional artist reserved a selected time before submission. The first
  form rejected it, removed occupied/buffered times, disabled submission and kept
  the notes.
- Sign-in navigation retained the booking return link; returning restored the
  service, date, still-available time and notes. Real Google/password authentication
  was not performed against customer accounts.
- An expired fixture disabled agreement acceptance. While version 2 was checked,
  publishing version 3 and refreshing data cleared consent and disabled acceptance.
- Mobile checks at 390px showed no horizontal page overflow for artist history,
  booking forms and producer availability settings. Desktop journey also exercised.
- Type checking and production build use isolated credentials. Temporary preview
  routes and local transport adapters are removed before deployment; their source
  and screenshots stay in ignored scratch files.

## Limits and data preservation

No live SQL, migration, customer booking, message, agreement, payment, email or
storage mutation was executed for this audit. No database change is required.
PGlite does not reproduce independent concurrent Postgres sessions; existing
room-locking logic was preserved. The local HTTP adapter substitutes for Supabase
transport/auth, so it is not proof of a real external-provider sign-in. Production
verification is limited to read-only pages and deployment evidence.

Existing requirements remain: active PRO, configured rooms/services/hours and the
producer's explicit publication. Historical query bounds, service editing,
rescheduling, deposits and calendar sync remain outside this change.
