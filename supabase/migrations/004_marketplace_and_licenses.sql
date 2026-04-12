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
