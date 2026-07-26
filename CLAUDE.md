# CLAUDE.md — working notes & invariants

Non-obvious conventions this codebase depends on. Several past bugs came from
violating these, so keep them in mind when editing money, auth, or data code.

## Database keys & naming

- **`wallets`** is keyed on **`producer_id`** (its primary key). There is **no
  `user_id` column**. Balances live in `available_balance` / `pending_balance`.
- **`payouts`** and **`ledger_transactions`** are also keyed on **`producer_id`**.
- **Favorites** live in the **`favorites`** table (`user_id`, `beat_id`,
  composite PK — **no `id` column**). A `beat_favorites` table does **not** exist;
  do not reference it. The `likes_count` denormalization trigger and the explore
  feed both key off `favorites`.
- **Notifications** use **`user_id`** = the recipient.

## Canonical enum casing = UPPERCASE

`ledger_transactions.type`/`.status` and `payouts.status` have `CHECK` constraints
that only accept UPPERCASE values:

- `ledger_transactions.type` ∈ `SALE | PAYOUT | REFUND | ADJUSTMENT`
- `ledger_transactions.status` ∈ `PENDING | AVAILABLE | FAILED`
- `payouts.status` ∈ `PROCESSING | SUCCESS | FAILED`

Writing lowercase silently fails the constraint. `producer_settings.subscription_tier`
is also stored UPPERCASE (`FREE | STARTER | PRO`) — the trending view and
platform-fee logic compare against `'PRO'`/`'STARTER'` literally.

## RLS & the service role

- Most write paths use the **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`),
  which **bypasses RLS**. RLS is the backstop for direct-from-browser anon access.
- **`notifications` INSERT is restricted to `auth.uid() = user_id`.** Any
  **cross-user** notification (e.g. notifying a producer of a buyer's offer) MUST
  go through the service-role client, not the request-scoped anon client.
- Never expose the private `beat-files` bucket paths (`file_mp3_url`,
  `file_wav_url`, `file_stems_url`) to `anon`. The `discovery_feed_trending` view
  deliberately omits them.

## Money pipeline invariants

- **Never trust client-supplied prices or discounts.** `checkout` re-derives the
  discount from the `promo_codes` row against the server-computed subtotal.
- Producer payouts are computed on the **amount actually collected** — checkout
  passes `conversion.payout_ratio` (collected ÷ subtotal) through Paystack
  metadata; `fulfillOrder` multiplies by it so the platform doesn't absorb the
  buyer's discount.
- `fulfillOrder` is **idempotent** via an atomic `pending → completed` flip; it's
  safe to call from both the webhook and the verify route.
- Wallet credits/debits use atomic RPCs (`credit_pending_balance`,
  `deduct_available_balance`, `restore_available_balance`, `clear_ledger_funds`,
  `process_mature_funds`) — never read-modify-write a balance in JS.
- `deduct_available_balance` returns `void` and **RAISEs** on insufficient funds —
  check the RPC **error**, not the (always-null) `data`.
- Exclusive beats are reserved atomically at checkout via `reserve_exclusive_beat`
  (short TTL) to prevent concurrent double-sale.

## Frontend

- Audio: the site-wide player is **WaveSurfer** via `playerStore`; the explore
  feed uses its own native `Audio`. They mutually exclude — the explore overlay
  pauses/hides the element with `id="global-player"` on mount. Keep that id.
- Card grids must avoid per-card auth/query storms. `FavoriteButton` resolves the
  user lazily on click (not on render); `useOwnedLicenses` shares one cached fetch
  across all cards (call `invalidateOwnedLicenses()` after a purchase).
- Shared domain types live in `lib/types.ts` — prefer them over redefining local
  `Beat` interfaces.

## Migrations

Forward-only SQL in `supabase/migrations/`, applied in numeric order. Numbering
has historical gaps (older files were merged into `001`–`009`; see the header
comments). Newest: `038_financial_and_security_hardening.sql`.
