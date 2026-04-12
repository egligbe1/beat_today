-- 008_add_avatars_bucket.sql
-- Creates the missing avatars bucket and sets up recursive RLS policies.

-- 1. Create the avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies for avatars bucket

-- Public Access: Anyone can view avatars
DROP POLICY IF EXISTS "Public Access to avatars" ON storage.objects;
CREATE POLICY "Public Access to avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatars
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- Users can update their own avatars
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' 
  AND (auth.uid() = owner OR auth.role() = 'service_role')
);

-- Users can delete their own avatars
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' 
  AND (auth.uid() = owner OR auth.role() = 'service_role')
);
