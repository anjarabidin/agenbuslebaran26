-- ============================================
-- SCHEMA: PWA Tiket Bus Operasional Agen
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Tabel Bus/Armada
CREATE TABLE IF NOT EXISTS buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode TEXT NOT NULL,
  nama TEXT NOT NULL,
  kapasitas INTEGER NOT NULL DEFAULT 24,
  arah TEXT NOT NULL CHECK (arah IN ('TIMUR', 'BARAT')),
  jam_berangkat TEXT NOT NULL DEFAULT '18:45',
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan constraint UNIQUE secara terpisah jika belum ada
DO $$
BEGIN
    -- Hapus constraint lama
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buses_kode_key') THEN
        ALTER TABLE buses DROP CONSTRAINT buses_kode_key;
    END IF;
    -- Tambahkan constraint baru (kode + tanggal) agar bis yang sama bisa jalan di hari berbeda
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buses_kode_tanggal_key') THEN
        ALTER TABLE buses ADD CONSTRAINT buses_kode_tanggal_key UNIQUE (kode, tanggal);
    END IF;
END $$;

-- 2. Tabel Rute
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  kota_asal TEXT NOT NULL,
  kota_tujuan TEXT NOT NULL,
  via_stops TEXT[] DEFAULT '{}',
  tanggal_berangkat DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Harga per Tujuan
CREATE TABLE IF NOT EXISTS route_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  tujuan TEXT NOT NULL,
  harga INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Status Kursi
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  nomor_kursi INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'locked', 'booked')),
  locked_by_agent TEXT,
  locked_at TIMESTAMPTZ,
  booking_id UUID,
  UNIQUE(bus_id, route_id, nomor_kursi)
);

-- 5. Tabel Booking
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID REFERENCES seats(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  nomor_kursi INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  agent_location TEXT NOT NULL,
  agent_phone TEXT NOT NULL DEFAULT '',  -- No WA agen sebagai identitas
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  tujuan TEXT NOT NULL,
  harga INTEGER NOT NULL,
  catatan TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabel Agen
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom agent_phone ada (antisipasi jika tabel sudah dibuat sebelumnya tanpa kolom ini)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='bookings' AND column_name='agent_phone'
    ) THEN
        ALTER TABLE bookings ADD COLUMN agent_phone TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- ============================================
-- FUNCTION: lock_seat (atomic, cegah double booking)
-- ============================================
CREATE OR REPLACE FUNCTION lock_seat(p_seat_id UUID, p_agent_name TEXT)
RETURNS JSON AS $$
DECLARE
  v_seat seats%ROWTYPE;
  v_lock_timeout INTERVAL := INTERVAL '5 minutes';
BEGIN
  -- Lock the row
  SELECT * INTO v_seat FROM seats WHERE id = p_seat_id FOR UPDATE NOWAIT;
  
  -- Check status
  IF v_seat.status = 'booked' THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sudah terpesan');
  END IF;
  
  -- Check if locked by someone else (not timed out)
  IF v_seat.status = 'locked' 
     AND v_seat.locked_by_agent != p_agent_name 
     AND v_seat.locked_at > NOW() - v_lock_timeout THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sedang dipilih oleh agen lain');
  END IF;
  
  -- Lock it
  UPDATE seats SET
    status = 'locked',
    locked_by_agent = p_agent_name,
    locked_at = NOW()
  WHERE id = p_seat_id;
  
  RETURN json_build_object('success', true, 'message', 'Kursi berhasil di-lock');
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sedang diproses, coba lagi');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: create_booking (atomic transaction)
-- ============================================
CREATE OR REPLACE FUNCTION create_booking(
  p_seat_id UUID,
  p_route_id UUID,
  p_bus_id UUID,
  p_nomor_kursi INTEGER,
  p_agent_name TEXT,
  p_agent_location TEXT,
  p_agent_phone TEXT,
  p_passenger_name TEXT,
  p_passenger_phone TEXT,
  p_tujuan TEXT,
  p_harga INTEGER,
  p_catatan TEXT
)
RETURNS JSON AS $$
DECLARE
  v_seat seats%ROWTYPE;
  v_booking_id UUID;
  v_lock_timeout INTERVAL := INTERVAL '5 minutes';
BEGIN
  SELECT * INTO v_seat FROM seats WHERE id = p_seat_id FOR UPDATE NOWAIT;
  
  IF v_seat.status = 'booked' THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sudah terpesan oleh agen lain');
  END IF;
  
  IF v_seat.status = 'locked' 
     AND v_seat.locked_by_agent != p_agent_name THEN
    IF v_seat.locked_at > NOW() - v_lock_timeout THEN
      RETURN json_build_object('success', false, 'message', 'Kursi sedang diproses oleh agen lain');
    END IF;
  END IF;
  
  INSERT INTO bookings (
    seat_id, route_id, bus_id, nomor_kursi,
    agent_name, agent_location, agent_phone,
    passenger_name, passenger_phone,
    tujuan, harga, catatan, status
  ) VALUES (
    p_seat_id, p_route_id, p_bus_id, p_nomor_kursi,
    p_agent_name, p_agent_location, p_agent_phone,
    p_passenger_name, p_passenger_phone,
    p_tujuan, p_harga, p_catatan, 'confirmed'
  ) RETURNING id INTO v_booking_id;
  
  UPDATE seats SET
    status = 'booked',
    booking_id = v_booking_id,
    locked_by_agent = p_agent_name,
    locked_at = NOW()
  WHERE id = p_seat_id;
  
  RETURN json_build_object('success', true, 'message', 'Tiket berhasil dipesan', 'booking_id', v_booking_id);
  
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sedang diproses, silakan coba lagi');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: cancel_booking
-- ============================================
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID)
RETURNS JSON AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Booking tidak ditemukan');
  END IF;
  
  -- Update booking status
  UPDATE bookings SET status = 'cancelled' WHERE id = p_booking_id;
  
  -- Release seat
  UPDATE seats SET
    status = 'available',
    booking_id = NULL,
    locked_by_agent = NULL,
    locked_at = NULL
  WHERE id = v_booking.seat_id;
  
  RETURN json_build_object('success', true, 'message', 'Booking berhasil dibatalkan');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: move_booking (pindah kursi oleh agen)
-- ============================================
DROP FUNCTION IF EXISTS move_booking(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION move_booking(
  p_booking_id UUID,
  p_new_seat_id UUID,
  p_agent_phone TEXT
)
RETURNS JSON AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_old_seat seats%ROWTYPE;
  v_new_seat seats%ROWTYPE;
BEGIN
  -- Ambil data booking
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND status = 'confirmed';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Booking tidak ditemukan atau sudah dibatalkan');
  END IF;

  -- Verifikasi no WA agen (keamanan: hanya agen yang beli yang bisa pindah)
  IF v_booking.agent_phone IS NOT NULL AND v_booking.agent_phone != '' AND v_booking.agent_phone != p_agent_phone THEN
    RETURN json_build_object('success', false, 'message', 'No WA tidak cocok. Hanya agen pemesan yang bisa memindahkan.');
  END IF;

  -- Lock kursi baru (cegah double)
  SELECT * INTO v_new_seat FROM seats WHERE id = p_new_seat_id FOR UPDATE NOWAIT;
  
  -- Jika kursi sudah dipesan (booked) atau di-lock orang lain yang belum timeout (5 menit)
  IF v_new_seat.status = 'booked' OR 
     (v_new_seat.status = 'locked' AND v_new_seat.locked_by_agent != v_booking.agent_name AND v_new_seat.locked_at > NOW() - INTERVAL '5 minutes') THEN
    RETURN json_build_object('success', false, 'message', 'Kursi tujuan sudah tidak tersedia');
  END IF;

  -- Lock kursi lama
  SELECT * INTO v_old_seat FROM seats WHERE id = v_booking.seat_id FOR UPDATE;

  -- Update kursi lama → available
  UPDATE seats SET
    status = 'available',
    booking_id = NULL,
    locked_by_agent = NULL,
    locked_at = NULL
  WHERE id = v_booking.seat_id;

  -- Update kursi baru → booked
  UPDATE seats SET
    status = 'booked',
    booking_id = p_booking_id,
    locked_by_agent = v_booking.agent_name,
    locked_at = NOW()
  WHERE id = p_new_seat_id;

  -- Update booking: nomor kursi + seat_id baru
  UPDATE bookings SET
    seat_id = p_new_seat_id,
    nomor_kursi = v_new_seat.nomor_kursi
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Kursi berhasil dipindahkan ke no. ' || v_new_seat.nomor_kursi,
    'nomor_kursi_baru', v_new_seat.nomor_kursi
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('success', false, 'message', 'Kursi sedang diproses, coba lagi');
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- Enable Realtime for seats table
-- ============================================
-- Safe way to add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'seats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE seats;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agents;
  END IF;
END $$;

-- ============================================
-- Row Level Security (biarkan publik baca)
-- ============================================
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Allow public read
DROP POLICY IF EXISTS "public read buses" ON buses;
CREATE POLICY "public read buses" ON buses FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public read routes" ON routes;
CREATE POLICY "public read routes" ON routes FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public read route_prices" ON route_prices;
CREATE POLICY "public read route_prices" ON route_prices FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public read seats" ON seats;
CREATE POLICY "public read seats" ON seats FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public read bookings" ON bookings;
CREATE POLICY "public read bookings" ON bookings FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public read agents" ON agents;
CREATE POLICY "public read agents" ON agents FOR SELECT TO anon USING (true);

-- Allow public write (through RPC functions)
DROP POLICY IF EXISTS "public update seats" ON seats;
CREATE POLICY "public update seats" ON seats FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "public insert bookings" ON bookings;
CREATE POLICY "public insert bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "public update bookings" ON bookings;
CREATE POLICY "public update bookings" ON bookings FOR UPDATE TO anon USING (true);
DROP POLICY IF EXISTS "public insert seats" ON seats;
CREATE POLICY "public insert seats" ON seats FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "public all agents" ON agents;
CREATE POLICY "public all agents" ON agents FOR ALL TO anon USING (true) WITH CHECK (true);

-- Admin full access
DROP POLICY IF EXISTS "admin all buses" ON buses;
CREATE POLICY "admin all buses" ON buses FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin all routes" ON routes;
CREATE POLICY "admin all routes" ON routes FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin all route_prices" ON route_prices;
CREATE POLICY "admin all route_prices" ON route_prices FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================
-- SAMPLE DATA (Optional - bisa hapus)
-- ============================================
INSERT INTO buses (kode, nama, kapasitas, arah, jam_berangkat) VALUES
  ('SHL-02', 'Jepara - Ciledug (Tangerang)', 24, 'TIMUR', '18:45'),
  ('SHL-03A', 'Jepara - Bubulak (Bogor)', 24, 'TIMUR', '18:45'),
  ('SHL-05', 'Jepara - Poris Plawad (Tangerang)', 24, 'TIMUR', '18:45'),
  ('SHL-06', 'Jepara - Merak', 24, 'TIMUR', '18:45'),
  ('SHL-10', 'Jepara - Bandung', 24, 'BARAT', '18:45'),
  ('SHL-SE2', 'Jepara - Parung (Bogor)', 24, 'BARAT', '18:45')
ON CONFLICT (kode, tanggal) DO NOTHING;
-- 11. Indeks Tambahan untuk Performa
CREATE INDEX IF NOT EXISTS idx_buses_aktif_jam ON buses(aktif, jam_berangkat);
CREATE INDEX IF NOT EXISTS idx_routes_bus_tanggal ON routes(bus_id, tanggal_berangkat);
CREATE INDEX IF NOT EXISTS idx_bookings_bus_id ON bookings(bus_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_seats_route_status ON seats(route_id, status);
