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
