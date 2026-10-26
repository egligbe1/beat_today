# Security deployment status

Marketplace-integrity was applied with explicit user authorization on 2026-10-26.
Supabase migration version: `20261026154145`. All original data was verified
unchanged across 26 public tables. See [LIVE_VERIFICATION.md](./LIVE_VERIFICATION.md)
and [REMEDIATION_STATUS.md](../REMEDIATION_STATUS.md) for current evidence and limits.

The earlier 039 financial protections were already live and were not reapplied.
Historical reset/wipe/setup scripts are archived under `legacy-destructive/` with
`.disabled` extensions. Never execute them or bulk-apply the migration directory.

Matching application revision `1d4a6d1` is live on Render; the public homepage
check passed. Use this revision or a compatible successor with this schema. Future SQL changes still
require explicit authorization after review under [AGENTS.md](../AGENTS.md).
Do not weaken grants or reset data to repair an application incompatibility.

Postgres upgrade to `17.11.0.003` and all five production background schedules
were completed with explicit authorization on 2026-10-26. See LIVE_VERIFICATION.md
for identifiers, cadence, data comparisons and observed HTTP 200 job results.
The public catalog remains available after upgrade. Earnings clearance moved
eligible pending funds to available without changing the wallet total.

Leaked-password protection remains disabled because the user is retaining Free.
No paid plan was purchased. No payout was forced as a verification transaction.
