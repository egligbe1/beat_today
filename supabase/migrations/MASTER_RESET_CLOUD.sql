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
