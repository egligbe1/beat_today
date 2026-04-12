-- 005_engagement_and_optimization.sql
-- Merges: 015, 017, 018, 021, 008, 029

-- 1. Notifications System
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, 
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Direct Messaging
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (participant_1, participant_2)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Collections (Albums/EPs)
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  collection_type TEXT NOT NULL DEFAULT 'album' CHECK (collection_type IN ('album', 'ep', 'compilation')),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  position SMALLINT DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (collection_id, beat_id)
);

-- Global Indices for Optimization
CREATE INDEX idx_notifications_user_id_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_participants ON conversations(participant_1, participant_2);
CREATE INDEX idx_collections_producer ON collections(producer_id);
CREATE INDEX idx_collection_beats_collection ON collection_beats(collection_id, position);

-- Extra Performance Indices (from 008/029)
CREATE INDEX IF NOT EXISTS idx_beats_bpm_performance ON beats(bpm);
CREATE INDEX IF NOT EXISTS idx_beats_price_mp3_performance ON beats(price_mp3);
CREATE INDEX IF NOT EXISTS idx_users_profiles_role_performance ON users_profiles(role);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_beats ENABLE ROW LEVEL SECURITY;

-- Policies: Notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Policies: Messaging
CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "conversations_manage" ON conversations FOR ALL USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "messages_select" ON messages FOR SELECT USING (EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (participant_1 = auth.uid() OR participant_2 = auth.uid())));
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Policies: Collections
CREATE POLICY "collections_select" ON collections FOR SELECT USING (is_published = TRUE OR auth.uid() = producer_id);
CREATE POLICY "collections_manage" ON collections FOR ALL USING (auth.uid() = producer_id);

CREATE POLICY "collection_beats_select" ON collection_beats FOR SELECT USING (EXISTS (SELECT 1 FROM collections WHERE id = collection_beats.collection_id AND (is_published = TRUE OR producer_id = auth.uid())));
CREATE POLICY "collection_beats_manage" ON collection_beats FOR ALL USING (EXISTS (SELECT 1 FROM collections WHERE id = collection_beats.collection_id AND producer_id = auth.uid()));
