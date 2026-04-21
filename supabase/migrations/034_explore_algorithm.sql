-- 034_explore_algorithm.sql
-- Implements a tiered trending discovery algorithm for the Explore feed.

-- 1. Create a function to calculate the heat score for a beat
-- This allows us to use it in ordering or views.
CREATE OR REPLACE FUNCTION calculate_beat_heat_score(
  p_beat_id UUID,
  p_created_at TIMESTAMPTZ,
  p_play_count INTEGER,
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
  
  -- 2. Engagement points (Calculated via subqueries for stability)
  v_engagement_score := (COALESCE(p_play_count, 0) * 1) + 
    ((SELECT count(*)::int FROM public.favorites WHERE beat_id = p_beat_id) * 10) + 
    ((SELECT count(*)::int FROM public.beat_comments WHERE beat_id = p_beat_id) * 20);
  
  -- 3. Recency Decay
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  
  -- 4. Final Score = (Base + Engagement) - (Decay: 5 points lost per hour)
  RETURN (v_tier_score + v_engagement_score) - (v_hours_old * 5);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Create an optimized Discovery view that pre-calculates these scores
-- Users can still filter as needed, but this is the primary engine for the Explore page.
CREATE OR REPLACE VIEW discovery_feed_trending AS
SELECT 
  b.*,
  calculate_beat_heat_score(b.id, b.created_at, b.play_count, ps.subscription_tier) as trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active' OR b.status = 'published';

-- 3. Update permissions
GRANT SELECT ON discovery_feed_trending TO anon, authenticated;
