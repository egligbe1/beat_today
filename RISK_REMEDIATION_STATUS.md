# Security follow-up — 2026-11-01

This is the current follow-up to `PLATFORM_SECURITY_AUDIT.md`. The original audit
records the earlier state; the changes below address its remaining risks.

## Released first batch

Commit `cbf8a9d` was pushed to `dev`; GitHub run 41301126558 passed all checks.
Render and the Vercel preview both responded HTTP 200 with the security headers.
The Vercel deployment status reported success. No customer transaction was tested.

## Second batch

- **Refund/dispute containment:** signed events create private, durable cases and
  append-only event history. Open cases block new payouts for the affected seller
  and credited collaborators. Unmatched events pause all new payouts. Duplicate
  event deliveries do not reopen reviewed cases. New provider outcomes do reopen
  them. Existing transfer verification continues; transfer retries check holds.
- **Private review screen:** explicit server-side `OPERATIONS_USER_IDS` allowlist;
  normal accounts cannot access case records. Releasing a hold records an operator,
  provider/accounting confirmations and review evidence. It does not initiate a
  refund or adjust wallet balances. Automatic refund allocation, debt recovery and
  already-paid earnings accounting still need business rules and implementation.
  Existing provider cases were not backfilled or replayed.
- **Upload verification:** browser uploads go to private quarantine. Signed tickets
  bind account, purpose, size and expiry. Images are decoded and re-encoded to WebP;
  WAV/MP3 structure is checked with bounded local reads; ZIP directories are checked
  for traversal, unsupported entries, encryption, symlinks and expansion limits.
  Conditional object reads/copies prevent replacement between verification and
  publication. Completion can recover a lost successful response. Only the new
  temporary quarantine object is removed after publication; no existing asset was
  removed by this work. Historical assets are retained. This is not antivirus or
  complete audio decoding/archive CRC verification. Failed quarantine objects are
  private and retained; no garbage-collection sweep ran. Storage quotas remain open.
- **Media processing:** the watermark worker restricts input protocols/demuxers and
  gives its child process a minimal environment without provider keys. The bundled
  native FFmpeg release is old; updating/isolating that runtime remains advisable.
- **Dependencies:** the newer `minimatch` dependency was scoped to patched 11.0.3;
  lint/type checks pass. The registry still flags legacy 3.1.5 in development lint
  dependencies. Its source lacks the newer preprocessing implementation described
  by the advisory; no application use was found. A blanket major-version override
  was avoided. The tooling advisory remains reported, not silently suppressed.
- **Release protection:** `dev` now requires the GitHub Actions `verify` check,
  up-to-date branch checks and resolved conversations. It applies to administrators;
  force pushes and branch deletion are disabled. Follow-up code goes through a PR.
- **Backups:** a public-key encrypted export tool is prepared; its default plan is
  offline. Export requires specific authorization and separate backup credentials.
  It reads a consistent database dump and both asset buckets without changing them.
  Encrypted files use authenticated AES-256-GCM with RSA-OAEP key wrapping; only the
  export public key is required. Interrupted exports do not get a completion marker.
  An isolated encrypted restore test preserved purchases, balances, licenses, asset
  bytes and RLS. No live database or asset backup/export/restore was executed.

## Specifically approved database operation

The user approved only `20261101111934_payment_case_holds.sql`. Applied to BeatToday
`chutqhuzargkpcmccfbg`, recorded remote version `20261101112654`.

SHA256: `31369b6fd24a9431101a6b172f2d53d2600c7a2ce8be93916d2323fd4dfcfcb4`.

Pre/post wallet, order, payout and ledger counts and aggregate balances were
unchanged. Both new tables were empty, with RLS enabled. Browser case reads and
anonymous event-recording execution were denied. Service-role event UPDATE and
case DELETE were denied. The payout guard trigger was present and no current
wallet was on hold. No financial test operation was performed in production.

## Configuration still needed

The operator account and backup destination have been requested from the user.
Until configured, operator access fails closed. Production monitoring still needs
`HEALTHCHECK_SECRET` and an authenticated monitor. The readiness endpoint includes
open payment cases and returns 503 when attention is required. Configure alerts
on meaningful changes and keep read-only health credentials separate from operator
account access.

Backups need an independent recovery private key, `BACKUP_DATABASE_URL`,
`BACKUP_PUBLIC_KEY`, a destination and an approved initial export. Keep recovery
keys independently from backups; never put private keys or database passwords in
GitHub, chat, command arguments or public logs. A full hosted Postgres recovery
exercise and independent off-platform copy remain pending.

Full browser journeys, broader social/API abuse protection, script-level CSP,
producer storage quotas and the Free-plan password-protection limitation remain
open. No paid plan was purchased.
