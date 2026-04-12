-- 002_catalog_and_storage.sql
-- Merges: 001, 004, 007, 009, 016, 022, 023, 024, 028

-- 1. Beats Table
CREATE TABLE beats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  genre TEXT,
  mood_tags TEXT[],
  bpm INTEGER,
  key TEXT,
  cover_url TEXT,
  mp3_preview_url TEXT,
  file_mp3_url TEXT,
  file_wav_url TEXT,
  file_stems_url TEXT,
  price_mp3 NUMERIC DEFAULT 29.99,
  price_wav NUMERIC DEFAULT 49.99,
  price_trackout NUMERIC DEFAULT 99.99,
  price_exclusive NUMERIC DEFAULT 499.99,
  play_count INTEGER DEFAULT 0,
  is_exclusive_sold BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'private', 'hidden')),
  is_free BOOLEAN DEFAULT FALSE NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'beat' CHECK (product_type IN ('beat', 'drumkit', 'sample_pack')),
  watermark_status TEXT DEFAULT 'none' CHECK (watermark_status IN ('none', 'pending', 'processing', 'done', 'failed')),
  watermarked_preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Watermark Job Queue
CREATE TABLE watermark_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watermark_jobs_beat_id_key UNIQUE (beat_id)
);

-- 3. Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('beat-covers', 'beat-covers', true),
  ('beat-previews', 'beat-previews', true),
  ('beat-files', 'beat-files', false)
ON CONFLICT (id) DO NOTHING;

-- Indices
CREATE INDEX idx_beats_producer_id ON beats(producer_id);
CREATE INDEX idx_beats_genre ON beats(genre);
CREATE INDEX idx_beats_status ON beats(status);
CREATE INDEX idx_beats_product_type ON beats(product_type);
CREATE INDEX idx_beats_created_at_desc ON beats(created_at DESC);
CREATE INDEX idx_watermark_jobs_status_created ON watermark_jobs (status, created_at ASC) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: Beats
CREATE POLICY "Public beats are viewable by everyone." ON beats
  FOR SELECT USING (status = 'published' OR auth.uid() = producer_id);

CREATE POLICY "Producers can insert their own beats." ON beats
  FOR INSERT WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "Producers can update own beats." ON beats
  FOR UPDATE USING (auth.uid() = producer_id);

CREATE POLICY "Producers can delete own beats." ON beats
  FOR DELETE USING (auth.uid() = producer_id);

-- Policies: Watermark Jobs (Service Role Only)
CREATE POLICY "service_role_only" ON watermark_jobs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policies: Storage (Refined with DROP to handle resets)
DROP POLICY IF EXISTS "Public Access to beat-covers" ON storage.objects;
CREATE POLICY "Public Access to beat-covers" ON storage.objects FOR SELECT USING (bucket_id = 'beat-covers');

DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'beat-covers' and auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own covers" ON storage.objects;
CREATE POLICY "Users can update own covers" ON storage.objects FOR UPDATE USING (bucket_id = 'beat-covers' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Users can delete own covers" ON storage.objects;
CREATE POLICY "Users can delete own covers" ON storage.objects FOR DELETE USING (bucket_id = 'beat-covers' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Public Access to beat-previews" ON storage.objects;
CREATE POLICY "Public Access to beat-previews" ON storage.objects FOR SELECT USING (bucket_id = 'beat-previews');

DROP POLICY IF EXISTS "Authenticated users can upload previews" ON storage.objects;
CREATE POLICY "Authenticated users can upload previews" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'beat-previews' and auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own previews" ON storage.objects;
CREATE POLICY "Users can update own previews" ON storage.objects FOR UPDATE USING (bucket_id = 'beat-previews' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Users can delete own previews" ON storage.objects;
CREATE POLICY "Users can delete own previews" ON storage.objects FOR DELETE USING (bucket_id = 'beat-previews' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Producers can view own files" ON storage.objects;
CREATE POLICY "Producers can view own files" ON storage.objects FOR SELECT USING (bucket_id = 'beat-files' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Producers can upload files" ON storage.objects;
CREATE POLICY "Producers can upload files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'beat-files' and auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Producers can update own files" ON storage.objects;
CREATE POLICY "Producers can update own files" ON storage.objects FOR UPDATE USING (bucket_id = 'beat-files' and (auth.uid() = owner OR auth.role() = 'service_role'));

DROP POLICY IF EXISTS "Producers can delete own files" ON storage.objects;
CREATE POLICY "Producers can delete own files" ON storage.objects FOR DELETE USING (bucket_id = 'beat-files' and (auth.uid() = owner OR auth.role() = 'service_role'));

-- 4. Play Count RPC
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE beats
  SET play_count = COALESCE(play_count, 0) + 1
  WHERE id = beat_id;
  
  -- Also increment the producer's total lifetime plays
  UPDATE producer_settings
  SET total_plays = COALESCE(total_plays, 0) + 1
  WHERE user_id = (SELECT producer_id FROM beats WHERE id = beat_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO anon;
