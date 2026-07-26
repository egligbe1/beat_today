-- 038_financial_and_security_hardening.sql
-- Fixes a set of critical financial-pipeline and security defects:
--   * Missing payout/clearing RPCs (process_mature_funds, restore_available_balance)
--   * Non-atomic wallet credit (credit_pending_balance)
--   * Promo usage never counted (increment_promo_usage)
--   * Exclusive double-sale race (reserve_exclusive_beat + column)
--   * Wallet RLS write-open to every authenticated user
--   * Notification forgery (open INSERT policy)
--   * Public discovery view leaking private master storage paths
--   * payouts table missing a currency column
--
-- Canonical casing for ledger_transactions/payouts status & type is UPPERCASE
-- (matches the CHECK constraints in 003). All application code is aligned to this.

-- ---------------------------------------------------------------------------
-- 1. Atomic pending credit (replaces the read-modify-write in fulfillOrder)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_pending_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.wallets (producer_id, pending_balance)
  VALUES (p_producer_id, p_amount)
  ON CONFLICT (producer_id)
  DO UPDATE SET pending_balance = wallets.pending_balance + EXCLUDED.pending_balance,
                updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Restore available balance (used when an outbound transfer fails)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets
  SET available_balance = available_balance + p_amount,
      updated_at = NOW()
  WHERE producer_id = p_producer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for producer %', p_producer_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Batch-mature pending funds older than a clearance window (7 days).
--    Moves matured PENDING SALE ledger rows -> AVAILABLE and shifts the
--    corresponding wallet balance. Idempotent: only touches PENDING rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_mature_funds(p_clearance_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT id, producer_id, amount
    FROM public.ledger_transactions
    WHERE status = 'PENDING'
      AND type = 'SALE'
      AND created_at <= NOW() - (p_clearance_days || ' days')::interval
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.ledger_transactions
    SET status = 'AVAILABLE', clearance_date = NOW()
    WHERE id = v_row.id AND status = 'PENDING';

    IF FOUND THEN
      UPDATE public.wallets
      SET pending_balance   = GREATEST(0, pending_balance - v_row.amount),
          available_balance = available_balance + v_row.amount,
          updated_at = NOW()
      WHERE producer_id = v_row.producer_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. Atomic promo usage increment, gated on remaining uses. Returns TRUE if
--    a use was successfully claimed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_promo_usage(p_promo_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.promo_codes
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE id = p_promo_id
    AND is_active = true
    AND (max_uses IS NULL OR COALESCE(uses_count, 0) < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. Exclusive-beat reservation (prevents concurrent exclusive double-sale).
--    Grants a short-lived reservation; returns TRUE only to the winner.
-- ---------------------------------------------------------------------------
ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS exclusive_reserved_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION reserve_exclusive_beat(p_beat_id UUID, p_ttl_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.beats
  SET exclusive_reserved_until = NOW() + (p_ttl_minutes || ' minutes')::interval
  WHERE id = p_beat_id
    AND is_exclusive_sold = false
    AND (exclusive_reserved_until IS NULL OR exclusive_reserved_until < NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 6. payouts: add the currency column the payout cron records against.
-- ---------------------------------------------------------------------------
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GHS';

-- ---------------------------------------------------------------------------
-- 6b. Normalize any existing subscription tiers to canonical UPPERCASE
--     (older callback code stored lowercase, which the trending view and
--     platform-fee logic mis-classify).
-- ---------------------------------------------------------------------------
UPDATE public.producer_settings
SET subscription_tier = UPPER(subscription_tier)
WHERE subscription_tier IS NOT NULL
  AND subscription_tier <> UPPER(subscription_tier);

-- ---------------------------------------------------------------------------
-- 7. RLS: remove the catastrophic write-open wallet policy.
--    Service role bypasses RLS; it needs no permissive policy. Producers keep
--    read-only access via the existing "view their own wallet" SELECT policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role manages wallets" ON public.wallets;

-- ---------------------------------------------------------------------------
-- 8. RLS: stop users forging notifications for arbitrary accounts.
--    System notifications are inserted via the service role (bypasses RLS).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. Discovery view: do NOT expose private master storage paths to anon.
--    Rebuild enumerating public/display columns only (drops file_mp3_url,
--    file_wav_url, file_stems_url). Keeps producer_id so PostgREST embedding
--    of users_profiles continues to resolve.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS discovery_feed_trending CASCADE;

CREATE VIEW discovery_feed_trending AS
SELECT
  b.id, b.producer_id, b.title, b.genre, b.mood_tags, b.bpm, b.key,
  b.cover_url, b.mp3_preview_url, b.watermarked_preview_url,
  b.price_mp3, b.price_wav, b.price_trackout, b.price_exclusive,
  b.play_count, b.is_exclusive_sold, b.status, b.is_free, b.product_type,
  b.watermark_status, b.likes_count, b.comments_count,
  b.created_at, b.updated_at,
  calculate_beat_heat_score(
    b.id, b.created_at, b.play_count,
    b.likes_count, b.comments_count,
    ps.subscription_tier
  ) AS trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active';

GRANT SELECT ON discovery_feed_trending TO anon, authenticated;
