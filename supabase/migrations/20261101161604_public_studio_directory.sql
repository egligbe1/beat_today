-- Approval required: additive public projection only. No record/balance changes.
BEGIN;
CREATE FUNCTION studio_booking_private.directory(p_query TEXT,p_city TEXT,p_service TEXT,p_page INTEGER)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result JSONB;
BEGIN
 IF length(coalesce(p_query,''))>80 OR length(coalesce(p_city,''))>80 OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000
 OR (p_service IS NOT NULL AND p_service NOT IN('RECORDING','MIXING','MASTERING','PRODUCTION')) THEN RAISE EXCEPTION 'Invalid directory filters'; END IF;
 WITH ready_services AS (
  SELECT r.studio_id,min(s.price_minor) AS from_minor,
   jsonb_agg(jsonb_build_object('title',s.title,'type',s.service_type,'duration_minutes',s.duration_minutes,'price_minor',s.price_minor) ORDER BY s.price_minor,s.id) AS services
  FROM public.studio_session_services s JOIN public.studio_rooms r ON r.id=s.room_id
  WHERE s.is_active AND (p_service IS NULL OR s.service_type=p_service)
   AND EXISTS(SELECT 1 FROM public.studio_opening_hours h WHERE h.room_id=r.id AND NOT h.closed
     AND h.closes-h.opens>=make_interval(mins=>s.duration_minutes+2*s.buffer_minutes))
  GROUP BY r.studio_id
 ), eligible AS (
  SELECT w.id,w.name AS studio_name,w.city,w.timezone,p.handle,p.display_name,p.avatar_url,p.country,s.from_minor,s.services
  FROM public.studio_workspaces w JOIN public.users_profiles p ON p.id=w.owner_id
  JOIN public.studio_booking_settings cfg ON cfg.studio_id=w.id AND cfg.is_public
  JOIN ready_services s ON s.studio_id=w.id
  WHERE p.role='producer' AND p.handle IS NOT NULL AND public.active_tier(w.owner_id)='PRO'
   AND (coalesce(trim(p_query),'')='' OR strpos(lower(concat_ws(' ',p.display_name,p.handle,w.name,w.city)),lower(trim(p_query)))>0)
   AND (coalesce(trim(p_city),'')='' OR strpos(lower(w.city),lower(trim(p_city)))>0)
 ), page AS (SELECT * FROM eligible ORDER BY lower(coalesce(display_name,handle)),id LIMIT 12 OFFSET (p_page-1)*12)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY lower(coalesce(display_name,handle)),id) FROM page),'[]'::JSONB),
 'total',(SELECT count(*) FROM eligible),'page',p_page,'page_size',12) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION studio_booking_private.directory(TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION studio_booking_private.directory(TEXT,TEXT,TEXT,INTEGER) TO anon,authenticated;
CREATE FUNCTION public.studio_booking_directory(p_query TEXT DEFAULT '',p_city TEXT DEFAULT '',p_service TEXT DEFAULT NULL,p_page INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT studio_booking_private.directory(p_query,p_city,p_service,p_page)
$$;
REVOKE ALL ON FUNCTION public.studio_booking_directory(TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.studio_booking_directory(TEXT,TEXT,TEXT,INTEGER) TO anon,authenticated;
COMMIT;
