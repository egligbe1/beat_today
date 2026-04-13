-- Add updated_at column to beat_reviews
ALTER TABLE beat_reviews 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create a trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_beat_reviews_updated_at ON beat_reviews;
CREATE TRIGGER update_beat_reviews_updated_at
    BEFORE UPDATE ON beat_reviews
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
