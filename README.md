# BeatToday

A BeatStars-style beat marketplace: producers upload and license instrumentals;
buyers stream, favorite, negotiate, and purchase licenses with instant delivery.
Built with Next.js 15 (App Router), Supabase, and Paystack.

## Stack

| Area | Tech |
|------|------|
| Framework | Next.js 15.5 (App Router, RSC) + TypeScript |
| Database / Auth / Storage | Supabase (Postgres + RLS) |
| Payments & payouts | Paystack (checkout, transfers, subscriptions) |
| Background jobs | Upstash QStash (crons, watermark queue) |
| Email | Resend |
| Audio | WaveSurfer.js (global player), native Audio (explore feed) |
| Media | ffmpeg-static (watermarking), sharp/jimp (images) |
| State | Zustand (`playerStore`, `cartStore`) |
| Styling | Tailwind CSS + framer-motion |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Connect to an existing Supabase project only after reviewing its deployed schema.
**Do not bulk-apply `supabase/migrations/`.** Historical destructive SQL has been quarantined under
`supabase/legacy-destructive/*.sql.disabled`: `026_wipe_transaction_history.sql` clears transaction history
and wallet balances. `MASTER_RESET_CLOUD.sql` and `supabase/SETUP_FRESH.sql` drop
the public schema. Never use these scripts to update an existing database.

Prepare individual, data-preserving migrations and obtain explicit authorization
for the exact migration before applying it. See [AGENTS.md](./AGENTS.md) for the
database safety requirements and [supabase/SECURITY_ROLLOUT.md](./supabase/SECURITY_ROLLOUT.md)
for the financial-access hardening scope and live verification status.

### Environment

See [`.env.example`](./.env.example) for the full list. The essentials:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — **server only**, bypasses RLS
- `NEXT_PUBLIC_SITE_URL` — base URL for OG tags, Paystack callbacks, share links
- `PAYSTACK_SECRET_KEY` — checkout, transfers, webhook signature verification
- `RESEND_API_KEY` — transactional email (license delivery)
- `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` — verify cron/queue calls
- `CRON_SECRET` — internal auth for the watermark worker (**fails closed if unset**)

## Project layout

```
app/
  api/                REST route handlers (checkout, webhooks, crons, payouts, …)
  (auth)/             login / signup / complete-profile
  dashboard/          producer & artist dashboard (upload, sales, wallet, …)
  [handle]/           public producer/artist profiles
  beats/[id]/         beat detail page
  explore/            TikTok-style vertical discovery feed
components/           UI components (player, beats, cart, explore, …)
lib/
  stores/             Zustand stores (player, cart)
  utils/              fulfillOrder, license/pdf generation, email, rates, …
  supabase/           server & browser client factories
supabase/migrations/  SQL history and reviewed updates; never bulk-apply
```

## Money flow (high level)

1. **Checkout** (`app/api/checkout`) validates prices & the promo **server-side**,
   reserves any exclusive licenses, creates a `pending` order, and initializes a
   Paystack transaction (charged in GHS).
2. **Fulfillment** (`lib/utils/fulfillOrder`) runs from either the Paystack
   **webhook** or the client **verify** route — it's idempotent via an atomic
   atomic database settlement. It credits producer wallets (on the amount
   actually collected, after discount and platform fee), generates + emails the
   license PDF, and locks exclusives.
3. **Clearance** (`app/api/cron/clear-funds`) moves matured pending funds to
   available after a 7-day window.
4. **Payouts** (`app/api/cron/payouts`) transfers available balances to producers'
   banks/mobile money via Paystack; failures restore the balance.

See [`CLAUDE.md`](./CLAUDE.md) for the invariants this pipeline depends on.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint

## Runtime and pending remediation rollout

Use Node 22.23.4 (`.nvmrc`). The marketplace-integrity changes are prepared locally
and require the reviewed timestamped migration plus a coordinated application
deployment. See [REMEDIATION_STATUS.md](./REMEDIATION_STATUS.md) before deploying.
Do not run migration push/reset commands against the existing project.

After that deployment, background jobs need QStash schedules. Print the plan
with `node scripts/setup-jobs.mjs`; creating schedules requires separate explicit
authorization and `--apply`. This script preserves existing schedules.
