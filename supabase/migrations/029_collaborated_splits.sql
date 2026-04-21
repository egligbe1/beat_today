-- 029_collaborated_splits.sql

CREATE TABLE beat_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE,
  collaborator_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  split_percentage NUMERIC NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  role TEXT DEFAULT 'Co-Producer', -- Or 'Songwriter', 'Mixer'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(beat_id, collaborator_id)
);

CREATE INDEX idx_beat_collaborators_beat_id ON beat_collaborators(beat_id);
CREATE INDEX idx_beat_collaborators_collaborator_id ON beat_collaborators(collaborator_id);

ALTER TABLE beat_collaborators ENABLE ROW LEVEL SECURITY;

-- The creator of the beat and any collaborator can view the splits
CREATE POLICY "Beat splits are viewable by everyone" ON beat_collaborators
  FOR SELECT USING (true);

-- Only primary producer can add/edit collaborators
CREATE POLICY "Primary producer manages splits" ON beat_collaborators
  FOR ALL USING (
    EXISTS (SELECT 1 FROM beats WHERE id = beat_collaborators.beat_id AND producer_id = auth.uid())
  );
