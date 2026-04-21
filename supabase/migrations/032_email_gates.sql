-- 032_email_gates.sql

CREATE TABLE producer_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  fan_email TEXT NOT NULL,
  fan_name TEXT,
  beat_id UUID REFERENCES beats(id) ON DELETE SET NULL, -- the beat that triggered the download
  source TEXT DEFAULT 'FREE_DOWNLOAD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producer_id, fan_email) -- fan can only be on a producer's list once
);

CREATE INDEX idx_audiences_producer ON producer_audiences(producer_id);

ALTER TABLE producer_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers view own audience" ON producer_audiences FOR SELECT USING (auth.uid() = producer_id);
-- Any authenticated or anon user can insert (sign up for free dl)
CREATE POLICY "Public insert audience" ON producer_audiences FOR INSERT WITH CHECK (true);
