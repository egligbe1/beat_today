-- 010_add_subscription_reference.sql
-- Adds missing subscription_reference column to producer_settings
-- AND ensures producer_settings are initialized for all producers

ALTER TABLE public.producer_settings 
ADD COLUMN IF NOT EXISTS subscription_reference TEXT;

-- Create an index for faster lookups/audits of transaction references
CREATE INDEX IF NOT EXISTS idx_producer_settings_subscription_ref ON producer_settings(subscription_reference);

-- Update the trigger function to handle producer_settings too
CREATE OR REPLACE FUNCTION public.handle_new_producer_setup() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    -- Ensure wallet exists
    INSERT INTO public.wallets (producer_id)
    VALUES (NEW.id)
    ON CONFLICT (producer_id) DO NOTHING;

    -- Ensure producer_settings exist
    INSERT INTO public.producer_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-map the trigger (dropping old one if it exists with different name)
DROP TRIGGER IF EXISTS on_producer_profile_created_wallet ON users_profiles;
DROP TRIGGER IF EXISTS on_producer_profile_created_setup ON users_profiles;

CREATE TRIGGER on_producer_profile_created_setup
  AFTER INSERT OR UPDATE ON users_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_producer_setup();

-- Backfill for any existing producers who might be missing settings
INSERT INTO public.producer_settings (user_id)
SELECT id FROM public.users_profiles WHERE role = 'producer'
ON CONFLICT (user_id) DO NOTHING;
