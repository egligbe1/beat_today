-- migration/036_fix_auth_onboarding.sql
-- Fixes Google/OAuth signups by ensuring they go through the application's onboarding flow
-- instead of being auto-created as "Artists".

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_handle TEXT;
  v_role TEXT;
BEGIN
  -- Extract role from metadata
  v_role := new.raw_user_meta_data->>'role';

  -- TRICK: If no role is provided (like in Google/OAuth), skip automatic creation.
  -- This allows the application (api/auth/callback) to detect the missing profile
  -- and redirect the user to the /complete-profile onboarding screen.
  IF v_role IS NULL THEN
    RETURN new;
  END IF;

  -- Generate a unique handle for email-signups (where role IS provided)
  v_handle := LOWER(REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '-', 'g'));
  v_handle := v_handle || '-' || floor(random() * 9999)::text;

  INSERT INTO public.users_profiles (id, display_name, avatar_url, handle, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    v_handle,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
