-- 007_status_alignment.sql
-- Restores 'active' status, updates security policies, and re-grants permissions.

-- 1. Update the CHECK constraint on beats table
ALTER TABLE public.beats 
  DROP CONSTRAINT IF EXISTS beats_status_check;

ALTER TABLE public.beats 
  ADD CONSTRAINT beats_status_check 
  CHECK (status IN ('draft', 'pending', 'active', 'private', 'hidden'));

-- 2. Update RLS policies to recognize 'active' instead of 'published'
DROP POLICY IF EXISTS "Public beats are viewable by everyone." ON public.beats;
CREATE POLICY "Public beats are viewable by everyone." ON public.beats
  FOR SELECT USING (status = 'active' OR auth.uid() = producer_id);

-- 3. Migrate existing 'published' tracks to 'active'
UPDATE public.beats 
SET status = 'active' 
WHERE status = 'published';

-- 4. Re-grant core permissions to ensure no stale blocks
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Fix default status
ALTER TABLE public.beats 
  ALTER COLUMN status SET DEFAULT 'draft';
