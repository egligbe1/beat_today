# Security deployment status

Marketplace-integrity was applied with explicit user authorization on 2026-10-26.
Supabase migration version: `20261026154145`. All original data was verified
unchanged across 26 public tables. See [LIVE_VERIFICATION.md](./LIVE_VERIFICATION.md)
and [REMEDIATION_STATUS.md](../REMEDIATION_STATUS.md) for current evidence and limits.

The earlier 039 financial protections were already live and were not reapplied.
Historical reset/wipe/setup scripts are archived under `legacy-destructive/` with
`.disabled` extensions. Never execute them or bulk-apply the migration directory.

Use the matching application revision with this schema. Future SQL changes still
require explicit authorization after review under [AGENTS.md](../AGENTS.md).
Do not weaken grants or reset data to repair an application incompatibility.

Provider actions still pending are leaked-password protection (requires Pro),
a separately approved Postgres maintenance upgrade, and activation/verification
of the reviewed background-job schedules. No real payments or mail were used
for verification. Isolated tests and production build passed before deployment.
