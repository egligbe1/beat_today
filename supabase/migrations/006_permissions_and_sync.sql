-- 006_permissions_and_sync.sql
-- Fixes: Permission Denied errors, Missing Profile Creation, and Role Synchronization.

-- 1. BASE PERMISSIONS RESTORATION
-- ==========================================
-- Ensures the 'authenticated' and 'anon' roles can actually use the public schema.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future tables also get these permissions automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 2. AUTOMATED USER CREATION TRIGGER
-- ==========================================
-- Automatically creates a public profile when a user signs up (e.g. via Google).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_handle TEXT;
BEGIN
  -- Generate a unique handle based on full name or email
  v_handle := LOWER(REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '-', 'g'));
  
  -- Add a random suffix to ensure uniqueness
  v_handle := v_handle || '-' || floor(random() * 9999)::text;

  INSERT INTO public.users_profiles (id, display_name, avatar_url, handle, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    v_handle,
    COALESCE(new.raw_user_meta_data->>'role', 'artist') -- Use metadata role if available, else default to artist
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. RLS HARDENING FOR ONBOARDING
-- ==========================================
-- Ensure users can actually UPSERT their own profiles during onboarding.

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.users_profiles;
CREATE POLICY "Users can insert their own profile." ON public.users_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.users_profiles;
CREATE POLICY "Users can update own profile." ON public.users_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. EMERGENCY RESET FOR PRODUCER SETTINGS
-- ==========================================
-- Ensure that if a user already exists in auth but not in profiles (due to the wipe),
-- we can still establish their producer settings when they onboarding.

DROP POLICY IF EXISTS "Producers can manage own settings." ON public.producer_settings;
CREATE POLICY "Producers can manage own settings." ON public.producer_settings
  FOR ALL USING (auth.uid() = user_id);

-- 5. SAFETY SYNC (One-time check)
-- ==========================================
-- Force-sync any profile that has producer_settings to be a 'producer'.
UPDATE public.users_profiles
SET role = 'producer'
WHERE id IN (SELECT user_id FROM public.producer_settings)
AND role != 'producer';

-- ==========================================
-- FIX COMPLETE. 
-- Please run this in the SQL Editor, then Refresh your browser.
-- ==========================================
