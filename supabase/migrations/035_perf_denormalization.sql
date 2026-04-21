-- Add denormalized engagement counters to beats table for high-performance discovery
ALTER TABLE public.beats 
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Backfill existing counts
UPDATE public.beats b
SET 
  likes_count = (SELECT count(*) FROM public.favorites f WHERE f.beat_id = b.id),
  comments_count = (SELECT count(*) FROM public.beat_comments c WHERE c.beat_id = b.id);

-- 1. Trigger function for Syncing Favorites Count
CREATE OR REPLACE FUNCTION public.sync_beat_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.beats SET likes_count = likes_count + 1 WHERE id = NEW.beat_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.beats SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.beat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function for Syncing Comments Count
CREATE OR REPLACE FUNCTION public.sync_beat_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.beats SET comments_count = comments_count + 1 WHERE id = NEW.beat_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.beats SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.beat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Triggers
DROP TRIGGER IF EXISTS tr_sync_beat_likes ON public.favorites;
CREATE TRIGGER tr_sync_beat_likes
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.sync_beat_likes_count();

DROP TRIGGER IF EXISTS tr_sync_beat_comments ON public.beat_comments;
CREATE TRIGGER tr_sync_beat_comments
AFTER INSERT OR DELETE ON public.beat_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_beat_comments_count();

-- 4. Update the optimized Discovery view to use these pre-calculated columns
-- This removes two subqueries per row, drastically speeding up the Explore page.
CREATE OR REPLACE FUNCTION calculate_beat_heat_score(
  p_beat_id UUID,
  p_created_at TIMESTAMPTZ,
  p_play_count INTEGER,
  p_likes_count INTEGER,
  p_comments_count INTEGER,
  p_tier TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_tier_score INTEGER;
  v_engagement_score INTEGER;
  v_hours_old NUMERIC;
BEGIN
  -- 1. Base Tier Score
  v_tier_score := CASE 
    WHEN p_tier = 'PRO' THEN 10000 
    WHEN p_tier = 'STARTER' THEN 5000 
    ELSE 0 
  END;
  
  -- 2. Engagement points (Now using pre-calculated columns)
  v_engagement_score := (COALESCE(p_play_count, 0) * 1) + 
    (COALESCE(p_likes_count, 0) * 10) + 
    (COALESCE(p_comments_count, 0) * 20);
  
  -- 3. Recency Decay
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  
  -- 4. Final Score = (Base + Engagement) - (Decay: 5 points lost per hour)
  RETURN (v_tier_score + v_engagement_score) - (v_hours_old * 5);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE VIEW discovery_feed_trending AS
SELECT 
  b.*,
  calculate_beat_heat_score(
    b.id, b.created_at, b.play_count, 
    b.likes_count, b.comments_count, 
    ps.subscription_tier
  ) as trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active';

GRANT SELECT ON discovery_feed_trending TO anon, authenticated;
