-- Add unique constraint to prevent duplicate reviews by the same user for the same beat
-- And to support ON CONFLICT (beat_id, reviewer_id) upserts
ALTER TABLE beat_reviews 
ADD CONSTRAINT unique_beat_reviewer UNIQUE (beat_id, reviewer_id);
