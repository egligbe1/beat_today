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
