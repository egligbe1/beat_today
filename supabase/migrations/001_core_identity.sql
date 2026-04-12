-- 001_core_identity.sql
-- Merges: 001, 002, 011, 012, 016

-- 1. Users Profiles
CREATE TABLE users_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  handle TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('producer', 'artist')),
  country TEXT,
  social_links JSONB DEFAULT '{}', -- { instagram, twitter, youtube, website, soundcloud, spotify }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Follows System
CREATE TABLE follows (
  follower_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- 3. Producer Settings
CREATE TABLE producer_settings (
  user_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  subscription_tier TEXT DEFAULT 'FREE', -- FREE, STARTER, PRO
  subscription_active BOOLEAN DEFAULT TRUE,
  subscription_expires_at TIMESTAMPTZ,
  bank_details JSONB DEFAULT '{}', -- { "bank_name", "account_number", "account_name", "bank_code" }
  flutterwave_account TEXT,
  paystack_account TEXT,
  total_plays BIGINT DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_users_profiles_role ON users_profiles(role);
CREATE INDEX idx_users_profiles_handle ON users_profiles(handle);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Enable RLS
ALTER TABLE users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE producer_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Users Profiles
CREATE POLICY "Public profiles are viewable by everyone." ON users_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON users_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON users_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies: Follows
CREATE POLICY "Follows are viewable by everyone" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON follows
  FOR ALL USING (auth.uid() = follower_id);

-- Policies: Producer Settings
CREATE POLICY "Producer settings are viewable by owner." ON producer_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Producers can insert own settings." ON producer_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Producers can update own settings." ON producer_settings
  FOR UPDATE USING (auth.uid() = user_id);
