-- Migration: Robust Play Tracking
-- Ensures that play counts are correctly tracked even if settings records are missing.

-- 1. Backfill any missing producer settings records
INSERT INTO producer_settings (user_id, total_plays)
SELECT id, 0 FROM users_profiles
WHERE role = 'producer'
ON CONFLICT (user_id) DO NOTHING;

-- 2. Redefine increment_beat_play_count to be self-healing
-- This ensures that if for some reason a producer doesn't have a settings record,
-- it is created the moment their first beat is played.
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id UUID)
RETURNS VOID AS $$
DECLARE
    target_producer_id UUID;
BEGIN
    -- 1. Identify the producer
    SELECT producer_id INTO target_producer_id FROM beats WHERE id = beat_id;
    
    -- 2. Ensure producer_settings record exists
    IF target_producer_id IS NOT NULL THEN
        INSERT INTO producer_settings (user_id, total_plays)
        VALUES (target_producer_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- 3. Increment play count on beats table
    UPDATE beats
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = beat_id;

    -- 4. Increment total plays on producer_settings table
    IF target_producer_id IS NOT NULL THEN
        UPDATE producer_settings
        SET total_plays = COALESCE(total_plays, 0) + 1
        WHERE user_id = target_producer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
