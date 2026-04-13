-- Function to handle auto-creation of producer settings
CREATE OR REPLACE FUNCTION handle_new_producer_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    INSERT INTO producer_settings (user_id, total_plays)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on users_profiles
DROP TRIGGER IF EXISTS tr_auto_producer_settings ON users_profiles;
CREATE TRIGGER tr_auto_producer_settings
AFTER INSERT OR UPDATE OF role ON users_profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_producer_settings();

-- Backfill existing producers
INSERT INTO producer_settings (user_id, total_plays)
SELECT id, 0 FROM users_profiles
WHERE role = 'producer'
ON CONFLICT (user_id) DO NOTHING;
