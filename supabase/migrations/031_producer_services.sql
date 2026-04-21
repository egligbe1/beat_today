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
