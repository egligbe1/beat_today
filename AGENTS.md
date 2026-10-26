# Project safety instructions

- The user explicitly requires preservation of the existing database and its data.
- Never run database resets, wipes, truncations, destructive migrations, schema drops, database recreation, or scripts that delete existing data. Never treat an audit, build, setup, or feature request as authorization for these actions.
- Do not apply SQL migrations or execute database/storage maintenance scripts without reviewing their full effects and obtaining explicit authorization for the specific operation. Prefer additive, data-preserving changes.
- In particular, do not execute `supabase/migrations/026_wipe_transaction_history.sql`, `supabase/migrations/MASTER_RESET_CLOUD.sql`, or `supabase/SETUP_FRESH.sql` against the user's database. Do not bulk-apply the migrations directory: it contains destructive historical SQL.
- Do not run storage garbage collection in execute mode or remove purchased audio/license assets without explicit authorization.
- For audits, use static inspection and isolated checks that do not contact or mutate the database. Do not launch application flows or production builds that might access live services without assessing their effects.
- Read `CLAUDE.md` for existing domain conventions. The initial architecture and audit are recorded in `CODEBASE_AUDIT.md` (2026-10-26); findings describe repository code, not verified live database state.

- Destructive legacy SQL has been quarantined under `supabase/legacy-destructive/*.sql.disabled`. Preserve it for historical reference only; never execute these archived scripts.
