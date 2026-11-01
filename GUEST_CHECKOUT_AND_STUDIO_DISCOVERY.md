# Producer discovery and guest checkout — 2026-11-01

## Artist discovery

The homepage hero and a dedicated studio CTA lead to `/producers`. The directory
supports producer/studio search, city, service and pagination. Only published
active-PRO studios with a usable service/opening-hours combination are listed.
Public data includes profile identity, studio city/timezone, service descriptions,
durations and prices; no appointments, artists, blocked-time notes or raw private
scheduling tables are exposed. A listing means booking is enabled, not that a
particular time is free. Session availability remains authoritative on its page.

`/join` gives the collective CTA an explicit destination: signed-in artists go to
producer discovery; producers go to their studio workspace; visitors go to
producer signup. No account role is changed.

## Guest purchase decision and experience

Account creation is optional for ordinary beat purchases. A guest supplies a full
license name, delivery email and license/terms acceptance. Signed-in purchases use
the account and still save to the library. Accepted negotiated offers require the
signed-in buyer. Studio booking/project collaboration still requires an account.

The existing server price, promotion, exclusive reservation, immutable snapshot,
exact settlement and wallet-credit algorithm is shared with guest purchases. No
client price authorizes payment. The license records the supplied guest legal
name/email. The checkout email is the delivery destination; Paystack validates
payment separately. No Auth user is created for a guest checkout.

The initial browser gets an HttpOnly, Secure-in-production, SameSite=Lax receipt
cookie scoped to its order. Guest contact records and receipt hashes/ciphertext
are service-only behind RLS. The raw receipt token is random and never placed in
a payment callback URL or query parameter. Private email links carry it in the
fragment, which the access page removes before exchanging it for the receipt
cookie. Receipt access expires after 14 days and cannot access another order.
Private downloads still require a completed purchase and the appropriate license.

Delivery emails include the immutable license PDF and a protected purchase link.
The same completed-order check gates account and guest downloads. Pending orders
are described as awaiting confirmation, never as proof that payment was received.
Only completed purchases are removed from matching cart entries.

Guests can request fresh links at `/purchases/recover`; responses do not reveal
whether an email has purchases. Recovery is limited by address, email and a global
budget. It sends one email containing recent unclaimed completed purchases, with
an optional payment-reference filter for a specific older purchase. Account-owned
purchases remain in the signed-in library.

Optional signup/sign-in is offered after purchase. Library linking requires a
fresh email confirmation bound to the authenticated account and its current email.
This proof is sent only to that email, expires in 15 minutes, and is independent of
Supabase signup auto-confirmation settings. The receipt cookie or merely entering
an email cannot claim purchases. The database claim RPC is service-only and checks
the account's authoritative Auth email. It changes ownership links only; original
legal text, signed timestamps, order totals and financial records remain unchanged.

## Approved database changes

- `20261101161604_public_studio_directory.sql`: applied with specific approval;
  remote version `20261101162058`. Read-only public directory functions.
- `20261101161606_guest_license_checkout.sql`: applied with specific approval;
  remote version `20261101163905`. Private guest records, a private shared pricing
  helper and restricted receipt/claim functions. The original pricing body matched
  the reviewed source before migration. Existing financial records, licenses and
  aggregate balances were unchanged afterward. New guest table remained empty.

See `supabase/LIVE_VERIFICATION.md` for hashes and grant verification. No real
payment, guest order, email, claim or customer booking was created as a test.

## Verification and operational limits

The full local suite passes 92 isolated tests, including publication/expiry and
pagination privacy, guest identity/receipt tampering, exact guest settlement and
replays, verified-email proof binding, ownership claims and unchanged legal text.
The existing marketplace suite also runs against the new shared pricing helper.
Type checks and production builds use dummy credentials; lint is clean.

Production customer/provider email delivery is not an executed test. Keep Resend,
Paystack and site URL configuration valid. For stable receipt-key rotation, set a
server-only `GUEST_RECEIPT_SECRET` of at least 32 random characters before initial
use and preserve it. If unset, the existing server Supabase key is used; rotating
that key without preserving the receipt key can prevent pending guest emails from
opening their encrypted receipt. Already issued receipts continue to validate by
hash; account linking uses fresh proof from the current configured key.

Private links are bearer credentials until expiry or account claim; keep them
private. Perimeter IP limits still depend on trusted proxy configuration. No paid
service or destructive maintenance action was introduced.
