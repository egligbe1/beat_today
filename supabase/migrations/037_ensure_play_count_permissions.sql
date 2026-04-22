-- Migration: Ensure Play Count Permissions
-- Ensures that the increment_beat_play_count function is accessible to all users
-- and that it handles NULL values correctly.

-- 1. Explicitly grant execute permissions
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO service_role;

-- 2. Optional: Ensure the function is as robust as possible (re-applying logic from 019 if needed)
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id UUID)
RETURNS VOID AS $$
DECLARE
    target_producer_id UUID;
BEGIN
    -- Identify the producer
    SELECT producer_id INTO target_producer_id FROM beats WHERE id = beat_id;
    
    -- Ensure producer_settings record exists if it doesn't
    IF target_producer_id IS NOT NULL THEN
        INSERT INTO producer_settings (user_id, total_plays)
        VALUES (target_producer_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Increment play count on beats table
    UPDATE beats
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = beat_id;

    -- Increment total plays on producer_settings table
    IF target_producer_id IS NOT NULL THEN
        UPDATE producer_settings
        SET total_plays = COALESCE(total_plays, 0) + 1
        WHERE user_id = target_producer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
