-- ============================================================
-- BeatToday — FULL FRESH SETUP (generated)
-- Paste this whole file into the Supabase SQL Editor and Run.
-- It wipes the public schema, then applies migrations 001-038 in order.
-- ============================================================

-- ===== MASTER_RESET_CLOUD.sql =====
-- ==========================================
-- CLEAN SWEEP RESET SCRIPT (Supabase Cloud)
-- ==========================================
-- WARNING: This will DELETE all existing data and tables.
-- Run this ONCE to prepare for manual reloading of 001-005.
-- ==========================================

-- 1. Wipe everything in the public schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 2. Restore standard permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ==========================================
-- RESET COMPLETE.
-- You can now run your 001_core_identity.sql file.
-- ==========================================


-- ===== 001_core_identity.sql =====
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


-- ===== 002_catalog_and_storage.sql =====
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


-- ===== 003_financial_engine.sql =====
-- 003_financial_engine.sql
-- Merges: 005, 010 (neutralized), 012, 013, 015, 020, 026

-- 1. Producer Wallet
CREATE TABLE wallets (
    producer_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available_balance NUMERIC DEFAULT 0.00,
    pending_balance NUMERIC DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    payout_currency VARCHAR(3) DEFAULT 'USD',
    recipient_code TEXT, -- Paystack Transfer Recipient Code (Bank)
    mobile_money_recipient_code TEXT, -- Paystack Recipient Code (Mobile Money)
    bank_details JSONB DEFAULT '{}', -- { "bank_name", "account_number", "account_name", "bank_code" }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_payout_at TIMESTAMPTZ
);

-- 2. Immutable Ledger
CREATE TABLE ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL, -- positive for credits (sales), negative for debits (payouts)
    type VARCHAR NOT NULL CHECK (type IN ('SALE', 'PAYOUT', 'REFUND', 'ADJUSTMENT')),
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AVAILABLE', 'FAILED')),
    description TEXT,
    reference_id VARCHAR, -- Order ID or Payout ID
    clearance_date TIMESTAMPTZ, -- When funds move from pending to available
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Payout Tracker
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    reference VARCHAR UNIQUE NOT NULL, -- Idempotency key for Paystack
    paystack_transfer_code VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_wallets_producer_id ON wallets(producer_id);
CREATE INDEX idx_ledger_producer_id ON ledger_transactions(producer_id);
CREATE INDEX idx_ledger_status ON ledger_transactions(status);
CREATE INDEX idx_payouts_producer_id ON payouts(producer_id);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Policies: Wallets
CREATE POLICY "Producers can view their own wallet" ON wallets
    FOR SELECT USING (auth.uid() = producer_id);

CREATE POLICY "Service role manages wallets" ON wallets
    FOR ALL USING (true) WITH CHECK (true);

-- Policies: Ledger
CREATE POLICY "Producers can view their own ledger" ON ledger_transactions
    FOR SELECT USING (auth.uid() = producer_id);

-- Policies: Payouts
CREATE POLICY "Producers can view their own payouts" ON payouts
    FOR SELECT USING (auth.uid() = producer_id);

-- 4. Financial RPCs

-- Deduct balance for payouts
CREATE OR REPLACE FUNCTION deduct_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE wallets
    SET available_balance = available_balance - p_amount,
        updated_at = NOW()
    WHERE producer_id = p_producer_id 
    AND available_balance >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient balance or wallet not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear funds (Move from pending to available)
CREATE OR REPLACE FUNCTION clear_ledger_funds(p_producer_id UUID, p_amount NUMERIC, p_transaction_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the specific ledger transaction
    UPDATE ledger_transactions
    SET status = 'AVAILABLE',
        clearance_date = NOW()
    WHERE id = p_transaction_id 
    AND status = 'PENDING'
    AND producer_id = p_producer_id;

    IF FOUND THEN
        -- 2. Update the wallet balances
        UPDATE wallets
        SET pending_balance = pending_balance - p_amount,
            available_balance = available_balance + p_amount,
            updated_at = NOW()
        WHERE producer_id = p_producer_id;
    ELSE
        RAISE EXCEPTION 'Transaction not found or already cleared';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create a wallet when a producer profile is created
CREATE OR REPLACE FUNCTION handle_new_producer_wallet() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    INSERT INTO public.wallets (producer_id)
    VALUES (NEW.id)
    ON CONFLICT (producer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_producer_profile_created_wallet ON users_profiles;
CREATE TRIGGER on_producer_profile_created_wallet
  AFTER INSERT OR UPDATE ON users_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_producer_wallet();


-- ===== 004_marketplace_and_licenses.sql =====
-- 004_marketplace_and_licenses.sql
-- Merges: 003, 006, 014, 021, 025, 027, 019 (partially for orders columns)

-- 1. Promo Codes Table (Move here so orders can reference it)
CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  -- NULL producer_id = platform-wide code
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL,
  max_uses INT, -- NULL = unlimited
  uses_count INT DEFAULT 0,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Orders System
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES users_profiles(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  gateway TEXT DEFAULT 'flutterwave',
  gateway_reference TEXT,
  promo_code_id UUID REFERENCES promo_codes(id), -- Integrated from 019
  discount_amount NUMERIC(10, 2) DEFAULT 0,    -- Integrated from 019
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES beats(id) ON DELETE SET NULL,
  producer_id UUID REFERENCES users_profiles(id) ON DELETE SET NULL,
  license_type TEXT NOT NULL,
  price NUMERIC NOT NULL,
  download_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Licenses & Templates
CREATE TABLE license_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('basic', 'premium', 'unlimited', 'exclusive')),
  name TEXT NOT NULL,
  streaming_limit INTEGER DEFAULT 50000,
  music_video_limit INTEGER DEFAULT 1,
  radio_broadcasting BOOLEAN DEFAULT FALSE,
  is_non_profit_only BOOLEAN DEFAULT TRUE,
  contract_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producer_id, type)
);

CREATE TABLE order_item_licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE UNIQUE,
  buyer_id UUID REFERENCES users_profiles(id),
  producer_id UUID REFERENCES users_profiles(id),
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE, 
  license_type TEXT NOT NULL,
  final_legal_text TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Reviews & Engagement
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID REFERENCES users_profiles(id) ON DELETE SET NULL,
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE favorites (
  user_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, beat_id)
);

-- Indices
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_producer_id ON order_items(producer_id);
CREATE INDEX idx_reviews_beat_id ON reviews(beat_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code) WHERE is_active = TRUE;
CREATE INDEX idx_promo_codes_producer ON promo_codes(producer_id);

-- Enable RLS
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policies: Promo Codes
CREATE POLICY "promo_codes_select" ON promo_codes FOR SELECT USING (auth.uid() = producer_id OR producer_id IS NULL);
CREATE POLICY "promo_codes_manage" ON promo_codes FOR ALL USING (auth.uid() = producer_id);

-- Policies: Orders
CREATE POLICY "Buyers can view their own orders." ON orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Buyers can insert their own orders." ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers can view their own order items." ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE id = order_items.order_id AND buyer_id = auth.uid()));
CREATE POLICY "Producers can view order items for their beats." ON order_items FOR SELECT USING (auth.uid() = producer_id);

-- Policies: Licenses
CREATE POLICY "Templates are viewable by producer owner." ON license_templates FOR SELECT USING (auth.uid() = producer_id);
CREATE POLICY "Producers can manage their own templates." ON license_templates FOR ALL USING (auth.uid() = producer_id);

CREATE POLICY "Buyers can view purchased licenses." ON order_item_licenses FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Producers can view licenses sold." ON order_item_licenses FOR SELECT USING (auth.uid() = producer_id);

-- Policies: Reviews & Favorites
CREATE POLICY "Reviews are public." ON reviews FOR SELECT USING (true);
CREATE POLICY "Buyers can leave reviews." ON reviews FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can view their own favorites." ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own favorites." ON favorites FOR ALL USING (auth.uid() = user_id);


-- ===== 005_engagement_and_optimization.sql =====
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


-- ===== 006_permissions_and_sync.sql =====
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


-- ===== 007_status_alignment.sql =====
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


-- ===== 008_add_avatars_bucket.sql =====
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


-- ===== 009_create_search_view.sql =====
-- 009_create_search_view.sql
-- Creates an optimized view for searching across tracks and producers.

-- Drop if exists to allow re-runs
DROP VIEW IF EXISTS search_catalog;

CREATE VIEW search_catalog AS
SELECT 
  b.id,
  b.title,
  b.genre,
  b.bpm,
  b.mood_tags,
  b.producer_id,
  b.cover_url,
  b.mp3_preview_url,
  b.status,
  b.watermark_status,
  b.price_mp3,
  b.price_wav,
  b.price_trackout,
  b.price_exclusive,
  b.is_exclusive_sold,
  b.is_free,
  b.play_count,
  b.product_type,
  b.created_at,
  p.handle as producer_handle,
  p.display_name as producer_display_name,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE (b.status = 'active' OR b.status = 'published') 
  AND (b.watermark_status = 'done' OR b.product_type != 'beat');

-- Enable access to the view for RLS-like behavior
-- Note: Views in Supabase don't have RLS themselves, but they respect the RLS of underlying tables if defined with SECURITY INVOKER (Postgres 15+).
-- Or we just GRANT SELECT.
GRANT SELECT ON search_catalog TO anon, authenticated;


-- ===== 010_add_subscription_reference.sql =====
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


-- ===== 015_rename_reviews_table.sql =====
-- Rename reviews table to beat_reviews
ALTER TABLE IF EXISTS reviews RENAME TO beat_reviews;

-- Rename buyer_id to reviewer_id if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beat_reviews' AND column_name = 'buyer_id') THEN
    ALTER TABLE beat_reviews RENAME COLUMN buyer_id TO reviewer_id;
  END IF;
END $$;

-- Drop old policies if they exist (they might have been renamed with the table or contain old references)
DROP POLICY IF EXISTS "Public can view reviews" ON beat_reviews;
DROP POLICY IF EXISTS "Buyers can create reviews" ON beat_reviews;
DROP POLICY IF EXISTS "Reviewers can update their own reviews" ON beat_reviews;

-- Create updated policies
CREATE POLICY "Public can view beat reviews"
  ON beat_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create reviews"
  ON beat_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.beat_id = beat_reviews.beat_id
      AND o.buyer_id = auth.uid()
      AND o.status = 'completed'
    )
  );

CREATE POLICY "Reviewers can update their own reviews"
  ON beat_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid());

CREATE POLICY "Reviewers can delete their own reviews"
  ON beat_reviews FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid());


-- ===== 016_auto_producer_settings.sql =====
-- Function to handle auto-creation of producer settings
CREATE OR REPLACE FUNCTION handle_new_producer_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'producer' THEN
    INSERT INTO producer_settings (user_id, total_plays)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on users_profiles
DROP TRIGGER IF EXISTS tr_auto_producer_settings ON users_profiles;
CREATE TRIGGER tr_auto_producer_settings
AFTER INSERT OR UPDATE OF role ON users_profiles
FOR EACH ROW
EXECUTE FUNCTION handle_new_producer_settings();

-- Backfill existing producers
INSERT INTO producer_settings (user_id, total_plays)
SELECT id, 0 FROM users_profiles
WHERE role = 'producer'
ON CONFLICT (user_id) DO NOTHING;


-- ===== 017_add_updated_at_reviews.sql =====
-- Add updated_at column to beat_reviews
ALTER TABLE beat_reviews 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create a trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_beat_reviews_updated_at ON beat_reviews;
CREATE TRIGGER update_beat_reviews_updated_at
    BEFORE UPDATE ON beat_reviews
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- ===== 018_unique_reviews.sql =====
-- Add unique constraint to prevent duplicate reviews by the same user for the same beat
-- And to support ON CONFLICT (beat_id, reviewer_id) upserts
ALTER TABLE beat_reviews 
ADD CONSTRAINT unique_beat_reviewer UNIQUE (beat_id, reviewer_id);


-- ===== 019_robust_play_tracking.sql =====
-- Migration: Robust Play Tracking
-- Ensures that play counts are correctly tracked even if settings records are missing.

-- 1. Backfill any missing producer settings records
INSERT INTO producer_settings (user_id, total_plays)
SELECT id, 0 FROM users_profiles
WHERE role = 'producer'
ON CONFLICT (user_id) DO NOTHING;

-- 2. Redefine increment_beat_play_count to be self-healing
-- This ensures that if for some reason a producer doesn't have a settings record,
-- it is created the moment their first beat is played.
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id UUID)
RETURNS VOID AS $$
DECLARE
    target_producer_id UUID;
BEGIN
    -- 1. Identify the producer
    SELECT producer_id INTO target_producer_id FROM beats WHERE id = beat_id;
    
    -- 2. Ensure producer_settings record exists
    IF target_producer_id IS NOT NULL THEN
        INSERT INTO producer_settings (user_id, total_plays)
        VALUES (target_producer_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- 3. Increment play count on beats table
    UPDATE beats
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = beat_id;

    -- 4. Increment total plays on producer_settings table
    IF target_producer_id IS NOT NULL THEN
        UPDATE producer_settings
        SET total_plays = COALESCE(total_plays, 0) + 1
        WHERE user_id = target_producer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 026_wipe_transaction_history.sql =====
-- Wipe all transaction history for a fresh start
-- This clears Artist purchases, Producer sales, and all financial ledger records.

-- 1. Clear Licenses
TRUNCATE TABLE order_item_licenses RESTART IDENTITY CASCADE;

-- 2. Clear Order Items & Orders
TRUNCATE TABLE order_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE orders RESTART IDENTITY CASCADE;

-- 3. Clear Financial Records
TRUNCATE TABLE ledger_transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE payouts RESTART IDENTITY CASCADE;

-- 4. Reset Wallet Balances
-- We keep the wallet records (to preserve bank info/Paystack codes) but reset balances to 0.
UPDATE wallets 
SET available_balance = 0, 
    pending_balance = 0;


-- ===== 029_collaborated_splits.sql =====
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


-- ===== 030_negotiations.sql =====
-- 030_negotiations.sql

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES beats(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'PAID')),
  message TEXT,
  checkout_url TEXT, -- populated upon ACCEPTED
  expires_at TIMESTAMPTZ, -- usually 48h after ACCEPTED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_buyer ON offers(buyer_id);
CREATE INDEX idx_offers_producer ON offers(producer_id);
CREATE INDEX idx_offers_beat ON offers(beat_id);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their offers" ON offers FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Producers can view offers sent to them" ON offers FOR SELECT USING (auth.uid() = producer_id);

CREATE POLICY "Buyers can insert offers" ON offers FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Producers can update offers" ON offers FOR UPDATE USING (auth.uid() = producer_id);


-- ===== 031_producer_services.sql =====
-- 031_producer_services.sql

CREATE TABLE producer_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  delivery_time_days INTEGER DEFAULT 3,
  cover_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES producer_services(id) ON DELETE SET NULL,
  producer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  price_paid NUMERIC NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  requirements_file_url TEXT, -- Stems/Notes from buyer
  delivery_file_url TEXT,    -- Final file from producer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_producer ON producer_services(producer_id);
CREATE INDEX idx_bookings_service ON service_bookings(service_id);
CREATE INDEX idx_bookings_buyer ON service_bookings(buyer_id);
CREATE INDEX idx_bookings_producer ON service_bookings(producer_id);

ALTER TABLE producer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active services" ON producer_services FOR SELECT USING (is_active = TRUE OR auth.uid() = producer_id);
CREATE POLICY "Producers manage their services" ON producer_services FOR ALL USING (auth.uid() = producer_id);

CREATE POLICY "Buyers view own bookings" ON service_bookings FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Producers view own bookings" ON service_bookings FOR SELECT USING (auth.uid() = producer_id);
CREATE POLICY "Buyers insert bookings" ON service_bookings FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Producers update bookings" ON service_bookings FOR UPDATE USING (auth.uid() = producer_id);


-- ===== 032_email_gates.sql =====
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


-- ===== 033_beat_comments.sql =====
-- 033_beat_comments.sql
-- Adds social commenting to beats for the discovery feed.

CREATE TABLE public.beat_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX idx_beat_comments_beat_id ON public.beat_comments(beat_id, created_at DESC);
CREATE INDEX idx_beat_comments_user_id ON public.beat_comments(user_id);

-- Enable RLS
ALTER TABLE public.beat_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view comments"
  ON public.beat_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can post comments"
  ON public.beat_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.beat_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.beat_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER handle_beat_comments_updated_at
  BEFORE UPDATE ON public.beat_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ===== 034_explore_algorithm.sql =====
-- 034_explore_algorithm.sql
-- Implements a tiered trending discovery algorithm for the Explore feed.

-- 1. Create a function to calculate the heat score for a beat
-- This allows us to use it in ordering or views.
CREATE OR REPLACE FUNCTION calculate_beat_heat_score(
  p_beat_id UUID,
  p_created_at TIMESTAMPTZ,
  p_play_count INTEGER,
  p_tier TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_tier_score INTEGER;
  v_engagement_score INTEGER;
  v_hours_old NUMERIC;
BEGIN
  -- 1. Base Tier Score
  v_tier_score := CASE 
    WHEN p_tier = 'PRO' THEN 10000 
    WHEN p_tier = 'STARTER' THEN 5000 
    ELSE 0 
  END;
  
  -- 2. Engagement points (Calculated via subqueries for stability)
  v_engagement_score := (COALESCE(p_play_count, 0) * 1) + 
    ((SELECT count(*)::int FROM public.favorites WHERE beat_id = p_beat_id) * 10) + 
    ((SELECT count(*)::int FROM public.beat_comments WHERE beat_id = p_beat_id) * 20);
  
  -- 3. Recency Decay
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  
  -- 4. Final Score = (Base + Engagement) - (Decay: 5 points lost per hour)
  RETURN (v_tier_score + v_engagement_score) - (v_hours_old * 5);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Create an optimized Discovery view that pre-calculates these scores
-- Users can still filter as needed, but this is the primary engine for the Explore page.
CREATE OR REPLACE VIEW discovery_feed_trending AS
SELECT 
  b.*,
  calculate_beat_heat_score(b.id, b.created_at, b.play_count, ps.subscription_tier) as trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active' OR b.status = 'published';

-- 3. Update permissions
GRANT SELECT ON discovery_feed_trending TO anon, authenticated;


-- ===== 035_perf_denormalization.sql =====
-- Add denormalized engagement counters to beats table for high-performance discovery
ALTER TABLE public.beats 
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Backfill existing counts
UPDATE public.beats b
SET 
  likes_count = (SELECT count(*) FROM public.favorites f WHERE f.beat_id = b.id),
  comments_count = (SELECT count(*) FROM public.beat_comments c WHERE c.beat_id = b.id);

-- 1. Trigger function for Syncing Favorites Count
CREATE OR REPLACE FUNCTION public.sync_beat_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.beats SET likes_count = likes_count + 1 WHERE id = NEW.beat_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.beats SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.beat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function for Syncing Comments Count
CREATE OR REPLACE FUNCTION public.sync_beat_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.beats SET comments_count = comments_count + 1 WHERE id = NEW.beat_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.beats SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.beat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply Triggers
DROP TRIGGER IF EXISTS tr_sync_beat_likes ON public.favorites;
CREATE TRIGGER tr_sync_beat_likes
AFTER INSERT OR DELETE ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.sync_beat_likes_count();

DROP TRIGGER IF EXISTS tr_sync_beat_comments ON public.beat_comments;
CREATE TRIGGER tr_sync_beat_comments
AFTER INSERT OR DELETE ON public.beat_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_beat_comments_count();

-- 4. Update the optimized Discovery view
-- Drop first to avoid column name mismatch error
DROP VIEW IF EXISTS discovery_feed_trending CASCADE;

CREATE OR REPLACE FUNCTION calculate_beat_heat_score(
  p_beat_id UUID,
  p_created_at TIMESTAMPTZ,
  p_play_count INTEGER,
  p_likes_count INTEGER,
  p_comments_count INTEGER,
  p_tier TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_tier_score INTEGER;
  v_engagement_score INTEGER;
  v_hours_old NUMERIC;
BEGIN
  -- 1. Base Tier Score
  v_tier_score := CASE 
    WHEN p_tier = 'PRO' THEN 10000 
    WHEN p_tier = 'STARTER' THEN 5000 
    ELSE 0 
  END;
  
  -- 2. Engagement points (Now using pre-calculated columns)
  v_engagement_score := (COALESCE(p_play_count, 0) * 1) + 
    (COALESCE(p_likes_count, 0) * 10) + 
    (COALESCE(p_comments_count, 0) * 20);
  
  -- 3. Recency Decay
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;
  
  -- 4. Final Score = (Base + Engagement) - (Decay: 5 points lost per hour)
  RETURN (v_tier_score + v_engagement_score) - (v_hours_old * 5);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE VIEW discovery_feed_trending AS
SELECT 
  b.*,
  calculate_beat_heat_score(
    b.id, b.created_at, b.play_count, 
    b.likes_count, b.comments_count, 
    ps.subscription_tier
  ) as trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active';

GRANT SELECT ON discovery_feed_trending TO anon, authenticated;


-- ===== 036_fix_auth_onboarding.sql =====
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


-- ===== 037_ensure_play_count_permissions.sql =====
-- Migration: Ensure Play Count Permissions
-- Ensures that the increment_beat_play_count function is accessible to all users
-- and that it handles NULL values correctly.

-- 1. Explicitly grant execute permissions
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_beat_play_count(UUID) TO service_role;

-- 2. Optional: Ensure the function is as robust as possible (re-applying logic from 019 if needed)
CREATE OR REPLACE FUNCTION increment_beat_play_count(beat_id UUID)
RETURNS VOID AS $$
DECLARE
    target_producer_id UUID;
BEGIN
    -- Identify the producer
    SELECT producer_id INTO target_producer_id FROM beats WHERE id = beat_id;
    
    -- Ensure producer_settings record exists if it doesn't
    IF target_producer_id IS NOT NULL THEN
        INSERT INTO producer_settings (user_id, total_plays)
        VALUES (target_producer_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- Increment play count on beats table
    UPDATE beats
    SET play_count = COALESCE(play_count, 0) + 1
    WHERE id = beat_id;

    -- Increment total plays on producer_settings table
    IF target_producer_id IS NOT NULL THEN
        UPDATE producer_settings
        SET total_plays = COALESCE(total_plays, 0) + 1
        WHERE user_id = target_producer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===== 038_financial_and_security_hardening.sql =====
-- 038_financial_and_security_hardening.sql
-- Fixes a set of critical financial-pipeline and security defects:
--   * Missing payout/clearing RPCs (process_mature_funds, restore_available_balance)
--   * Non-atomic wallet credit (credit_pending_balance)
--   * Promo usage never counted (increment_promo_usage)
--   * Exclusive double-sale race (reserve_exclusive_beat + column)
--   * Wallet RLS write-open to every authenticated user
--   * Notification forgery (open INSERT policy)
--   * Public discovery view leaking private master storage paths
--   * payouts table missing a currency column
--
-- Canonical casing for ledger_transactions/payouts status & type is UPPERCASE
-- (matches the CHECK constraints in 003). All application code is aligned to this.

-- ---------------------------------------------------------------------------
-- 1. Atomic pending credit (replaces the read-modify-write in fulfillOrder)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_pending_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.wallets (producer_id, pending_balance)
  VALUES (p_producer_id, p_amount)
  ON CONFLICT (producer_id)
  DO UPDATE SET pending_balance = wallets.pending_balance + EXCLUDED.pending_balance,
                updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Restore available balance (used when an outbound transfer fails)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restore_available_balance(p_producer_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets
  SET available_balance = available_balance + p_amount,
      updated_at = NOW()
  WHERE producer_id = p_producer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for producer %', p_producer_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Batch-mature pending funds older than a clearance window (7 days).
--    Moves matured PENDING SALE ledger rows -> AVAILABLE and shifts the
--    corresponding wallet balance. Idempotent: only touches PENDING rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_mature_funds(p_clearance_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT id, producer_id, amount
    FROM public.ledger_transactions
    WHERE status = 'PENDING'
      AND type = 'SALE'
      AND created_at <= NOW() - (p_clearance_days || ' days')::interval
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.ledger_transactions
    SET status = 'AVAILABLE', clearance_date = NOW()
    WHERE id = v_row.id AND status = 'PENDING';

    IF FOUND THEN
      UPDATE public.wallets
      SET pending_balance   = GREATEST(0, pending_balance - v_row.amount),
          available_balance = available_balance + v_row.amount,
          updated_at = NOW()
      WHERE producer_id = v_row.producer_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 4. Atomic promo usage increment, gated on remaining uses. Returns TRUE if
--    a use was successfully claimed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_promo_usage(p_promo_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.promo_codes
  SET uses_count = COALESCE(uses_count, 0) + 1
  WHERE id = p_promo_id
    AND is_active = true
    AND (max_uses IS NULL OR COALESCE(uses_count, 0) < max_uses)
    AND (expires_at IS NULL OR expires_at > NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. Exclusive-beat reservation (prevents concurrent exclusive double-sale).
--    Grants a short-lived reservation; returns TRUE only to the winner.
-- ---------------------------------------------------------------------------
ALTER TABLE public.beats
  ADD COLUMN IF NOT EXISTS exclusive_reserved_until TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION reserve_exclusive_beat(p_beat_id UUID, p_ttl_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.beats
  SET exclusive_reserved_until = NOW() + (p_ttl_minutes || ' minutes')::interval
  WHERE id = p_beat_id
    AND is_exclusive_sold = false
    AND (exclusive_reserved_until IS NULL OR exclusive_reserved_until < NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 6. payouts: add the currency column the payout cron records against.
-- ---------------------------------------------------------------------------
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'GHS';

-- ---------------------------------------------------------------------------
-- 6b. Normalize any existing subscription tiers to canonical UPPERCASE
--     (older callback code stored lowercase, which the trending view and
--     platform-fee logic mis-classify).
-- ---------------------------------------------------------------------------
UPDATE public.producer_settings
SET subscription_tier = UPPER(subscription_tier)
WHERE subscription_tier IS NOT NULL
  AND subscription_tier <> UPPER(subscription_tier);

-- ---------------------------------------------------------------------------
-- 7. RLS: remove the catastrophic write-open wallet policy.
--    Service role bypasses RLS; it needs no permissive policy. Producers keep
--    read-only access via the existing "view their own wallet" SELECT policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role manages wallets" ON public.wallets;

-- ---------------------------------------------------------------------------
-- 8. RLS: stop users forging notifications for arbitrary accounts.
--    System notifications are inserted via the service role (bypasses RLS).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. Discovery view: do NOT expose private master storage paths to anon.
--    Rebuild enumerating public/display columns only (drops file_mp3_url,
--    file_wav_url, file_stems_url). Keeps producer_id so PostgREST embedding
--    of users_profiles continues to resolve.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS discovery_feed_trending CASCADE;

CREATE VIEW discovery_feed_trending AS
SELECT
  b.id, b.producer_id, b.title, b.genre, b.mood_tags, b.bpm, b.key,
  b.cover_url, b.mp3_preview_url, b.watermarked_preview_url,
  b.price_mp3, b.price_wav, b.price_trackout, b.price_exclusive,
  b.play_count, b.is_exclusive_sold, b.status, b.is_free, b.product_type,
  b.watermark_status, b.likes_count, b.comments_count,
  b.created_at, b.updated_at,
  calculate_beat_heat_score(
    b.id, b.created_at, b.play_count,
    b.likes_count, b.comments_count,
    ps.subscription_tier
  ) AS trending_score,
  ps.subscription_tier
FROM beats b
JOIN users_profiles p ON b.producer_id = p.id
LEFT JOIN producer_settings ps ON p.id = ps.user_id
WHERE b.status = 'active';

GRANT SELECT ON discovery_feed_trending TO anon, authenticated;

