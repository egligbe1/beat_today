# Booking calendar, custom enquiries and live communication

## Changes

- Date fields in artist requests, producer calendars and milestones open the
  native date calendar when the field itself is clicked. The icon stays visible
  on dark backgrounds; Enter/Space also open the picker. Native editing remains
  available where the browser does not support showPicker.
- Artists can choose Request a custom service on a producer profile or booking
  page. A brief includes the work, preferred dates/deadline and optional budget.
  Sending explicitly creates a message, not a calendar reservation, agreement or
  charge. Signing in preserves the brief in tab-local session storage, but never
  automatically sends it. Producers can discuss scope and then create a service
  or use the existing shared-project/agreement flow.
- Sent messages render from the successful send response immediately, independently
  of realtime events. Incoming socket events trigger authorized catch-up reads.
  Message IDs remove duplicate echoes; ordering/cursors preserve Postgres
  microseconds and stable IDs. Failed sends retain the draft and allow retry.
- Visible chat catches up every five seconds and on reconnect/focus, covering lost
  events or a sleeping device. Inbox, notifications and studio views subscribe to
  their authorized records and refresh automatically, with bounded fallback reads.
- Read status is updated only by the recipient's checked API for displayed messages
  while following the visible thread. Refresh and notifications do not assume a
  write succeeded. Agreement-version acceptance remains bound to its exact ID.

## Authorized migration

The user approved only 20261026210512_realtime_messaging_and_studio.sql. It was
reviewed fully and applied through Supabase MCP. It adds eight existing tables to
supabase_realtime after checking RLS/SELECT policies, and revokes direct browser
chat writes; all application writes already use the checked server API. It does
not change customer rows, subscriptions, balances or assets.

Preflight confirmed all eight tables had RLS and participant/recipient read rules,
but none were in the realtime publication. After application all eight were
published, RLS remained enabled, authenticated SELECT remained available, direct
chat INSERT/UPDATE/DELETE were unavailable and server-role INSERT remained allowed.
Before/after row fingerprints and counts matched for all eight tables.

Security advisors were unchanged: internal service-only tables deliberately have
no browser policies, schema-discoverability notices remain, and the previously
noted Free-plan password-protection limitation remains. No new open-table or
privileged-function finding was introduced.

## Verification

- Isolated tests cover deduplication, microsecond ordering, compound pagination,
  retained rows, repeatable publication, guards for missing RLS, participant-only
  reads and rejected browser writes. Existing finance/studio tests also pass.
- Real components were exercised in Chrome using a temporary local HTTP fixture
  and fictional users. Sending rendered immediately without a socket event;
  a simulated producer reply arrived through catch-up without refreshing; a
  failed send kept its draft. Clicking date text away from the icon opened the
  calendar. The custom brief reached the fictional server with schedule, budget
  and an explicit unconfirmed-enquiry statement.
- No real messages, test bookings, notifications, agreements, emails or payments
  were generated in production. The live database verification was read-only
  around the specifically approved schema/publication operation.
- Local fixture transports do not prove two-account production socket delivery.
  Live publication, permissions and RLS were independently verified. Browser
  fallback behaviour was tested with realtime intentionally unavailable.
- Temporary routes and test adapters remain outside production; source/screenshots
  are preserved only in ignored scratch/chat-ux. Builds use dummy credentials and
  an unused loopback Supabase URL.
