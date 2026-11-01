# BeatToday operations and recovery

Updated 2026-11-01. Owner: the platform operator. These procedures preserve customer
records and purchased assets. They do not authorize SQL, maintenance, refunds,
transfers, deletion or a production restore.

## Monitoring

- `/api/health` and `/api/ping` are public liveness checks only.
- `/api/health/readiness` requires `Authorization: Bearer <HEALTHCHECK_SECRET>`.
  Configure an independent random secret of at least 32 characters in the hosting
  environment and the monitor's secret store. Never put it in a URL, browser code,
  source control, screenshots or public logs. The endpoint fails closed when unset.
- Readiness checks required configuration, database access, pending/failed license
  delivery counts, failed watermark jobs, stale processing leases and the count
  of recorded payment exceptions. It only reads; it never claims/retries work.
- HTTP 503 means missing configuration, a failed dependency check or failed/stale
  jobs requiring investigation. A growing pending-delivery count also requires
  investigation even when readiness returns 200. Exception counts include
  historical records and do not prove how many cases remain unresolved.
- Check scheduled-job execution in QStash/hosting logs separately. Configuration
  presence does not prove a valid key, correct schedule or successful provider.
- Notify on a new failure, meaningful backlog growth or a stale lease; avoid
  repeatedly notifying about the same acknowledged incident.

## A customer paid but has no license/download

1. Capture the saved payment reference, order ID and symptom privately. Never ask
   for card details or publish private order/message contents in an issue.
2. Compare provider verification with the saved checkout amount/currency/reference.
   Check the server error and `payment_reconciliations` entry through authorized
   operator access. No evidence of payment means no manual wallet credit.
3. If settled, check the immutable license and asset snapshot. An email failure
   should be retried from its delivery job, not by repeating settlement or creating
   another charge. Customers can use their library while email is delayed.
4. For a late exclusive conflict or a true refund/dispute, preserve the records and
   review the required customer/provider resolution. Refund/chargeback accounting
   is not yet automated. Obtain approval for each actual money operation.
5. Record the investigation and eventual resolution in the private incident log.
   The current exception table has no reviewed resolution state; do not delete
   exception rows to make the count disappear.

## A payout is processing or failed

- Compare the saved transfer reference/payload with provider status. A timeout is
  ambiguous and does not authorize another transfer or restoration.
- Use the existing reconciliation/state-transition path after authoritative
  evidence. Never edit wallet balance fields or create an unrelated transfer to
  compensate for uncertainty. Require authorization before any manual money action.
- Preserve signed event evidence and status history. A failed/reversed transfer
  must restore reserved funds once, not once per webhook delivery.

## A preview or email job is stuck

- Inspect job status, claim time, attempts and the sanitized error. Check provider
  configuration and logs without copying credentials or customer content.
- Correct the cause before retrying. Use the existing queue/claim path so leases
  and provider idempotency keys remain intact. A retry is a separate operational
  action; the readiness endpoint never performs it.
- Do not remove clean masters, purchased stems, license snapshots or old agreements
  to recover space or clear a failed job.

## Release and application rollback

- Run the committed isolated CI checks before release. CI must be made a required
  check and connected to the hosting deploy policy before it actually gates deploys.
- Record the deployed revision and verify liveness plus an authenticated readiness
  response. Browser smoke tests must use isolated fixtures or a separately
  approved test environment, never customer messages/purchases.
- If necessary, redeploy the previous known-good application revision. The
  idempotent-message schema addition is compatible with the earlier application;
  do not drop its column/index/function or reverse migrations as a rollback.
- `MESSAGE_IDEMPOTENCY_ENABLED=false` permits the older send path temporarily.
  Document that duplicate-send protection is disabled until the flag is restored.

## Backup and restore drill — still to be exercised

- Inventory actual database backup/export capability for the current Free plan;
  do not assume point-in-time recovery or provider backups exist.
- Establish encrypted off-platform database exports and independent private/public
  asset copies, including immutable purchased assets. Limit access and retention.
  Backup/export jobs need their own reviewed operational setup.
- Restore only into a separately approved isolated environment. Validate row counts,
  ownership/RLS, completed purchases, immutable licenses, asset retrieval and job
  behavior with all external sending/payment actions disabled.
- Record the recovery point/time achieved, evidence and missing components.
- A production restore or upgrade is a separately reviewed operation with explicit
  approval. Never use reset/setup or quarantined destructive SQL as recovery tools.
