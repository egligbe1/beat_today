-- Booking-first studio workflow. Pending review and explicit deployment approval.
-- Adds scheduling records/functions; does not delete/rewrite existing business data.
BEGIN;
CREATE SCHEMA studio_booking_private;
REVOKE ALL ON SCHEMA studio_booking_private FROM PUBLIC;
GRANT USAGE ON SCHEMA studio_booking_private TO anon,authenticated;
CREATE TABLE public.studio_booking_settings (
 studio_id UUID PRIMARY KEY REFERENCES public.studio_workspaces(id),
 is_public BOOLEAN NOT NULL DEFAULT false,
 notice_hours INTEGER NOT NULL DEFAULT 12 CHECK(notice_hours BETWEEN 0 AND 168),
 horizon_days INTEGER NOT NULL DEFAULT 90 CHECK(horizon_days BETWEEN 1 AND 180)
);
CREATE TABLE public.studio_rooms (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), studio_id UUID NOT NULL REFERENCES public.studio_workspaces(id),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX studio_rooms_studio ON public.studio_rooms(studio_id);
CREATE TABLE public.studio_session_services (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES public.studio_rooms(id),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 service_type TEXT NOT NULL DEFAULT 'RECORDING' CHECK(service_type IN('RECORDING','MIXING','MASTERING','PRODUCTION')),
 duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 30 AND 480 AND duration_minutes%30=0),
 buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK(buffer_minutes BETWEEN 0 AND 120),
 price_minor BIGINT NOT NULL CHECK(price_minor BETWEEN 0 AND 100000000),
 is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX studio_services_room ON public.studio_session_services(room_id);
CREATE TABLE public.studio_opening_hours (
 room_id UUID NOT NULL REFERENCES public.studio_rooms(id), weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 opens TIME NOT NULL DEFAULT '09:00', closes TIME NOT NULL DEFAULT '18:00', closed BOOLEAN NOT NULL DEFAULT false,
 PRIMARY KEY(room_id,weekday), CHECK(closes>opens)
);
CREATE TABLE public.studio_time_blocks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID NOT NULL REFERENCES public.studio_rooms(id),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
 reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 2 AND 300), is_active BOOLEAN NOT NULL DEFAULT true, CHECK(ends_at>starts_at)
);
CREATE INDEX studio_blocks_room_time ON public.studio_time_blocks(room_id,starts_at,ends_at);
CREATE TABLE public.studio_bookings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), studio_id UUID NOT NULL REFERENCES public.studio_workspaces(id),
 room_id UUID NOT NULL REFERENCES public.studio_rooms(id), service_id UUID NOT NULL REFERENCES public.studio_session_services(id),
 producer_id UUID NOT NULL REFERENCES public.users_profiles(id), artist_id UUID NOT NULL REFERENCES public.users_profiles(id),
 project_id UUID UNIQUE REFERENCES public.studio_projects(id),
 starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, buffer_minutes INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','RESERVED','CONFIRMED','DECLINED','CANCELLED','COMPLETED')),
 reserved_until TIMESTAMPTZ, notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=3000),
 service_snapshot JSONB NOT NULL, outcome_reason TEXT CHECK(length(outcome_reason)<=1000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at AND producer_id<>artist_id AND buffer_minutes BETWEEN 0 AND 120),
 CHECK(status NOT IN('RESERVED','CONFIRMED','COMPLETED') OR project_id IS NOT NULL)
);
CREATE INDEX studio_booking_owner ON public.studio_bookings(producer_id,starts_at);
CREATE INDEX studio_booking_artist ON public.studio_bookings(artist_id,starts_at);
CREATE INDEX studio_booking_room ON public.studio_bookings(room_id,starts_at,ends_at) WHERE status IN('RESERVED','CONFIRMED');
CREATE UNIQUE INDEX studio_booking_pending ON public.studio_bookings(artist_id,room_id,starts_at) WHERE status='REQUESTED';
ALTER TABLE public.studio_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_session_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_booking_settings_owner ON public.studio_booking_settings FOR SELECT TO authenticated USING(studio_id IN(SELECT id FROM public.studio_workspaces WHERE owner_id=(SELECT auth.uid())));
CREATE POLICY studio_rooms_owner ON public.studio_rooms FOR SELECT TO authenticated USING(studio_id IN(SELECT id FROM public.studio_workspaces WHERE owner_id=(SELECT auth.uid())));
CREATE POLICY studio_session_services_owner ON public.studio_session_services FOR SELECT TO authenticated USING(room_id IN(SELECT id FROM public.studio_rooms));
CREATE POLICY studio_opening_hours_owner ON public.studio_opening_hours FOR SELECT TO authenticated USING(room_id IN(SELECT id FROM public.studio_rooms));
CREATE POLICY studio_time_blocks_owner ON public.studio_time_blocks FOR SELECT TO authenticated USING(room_id IN(SELECT id FROM public.studio_rooms));
CREATE POLICY studio_booking_participant ON public.studio_bookings FOR SELECT TO authenticated USING(producer_id=(SELECT auth.uid()) OR artist_id=(SELECT auth.uid()));
REVOKE ALL ON public.studio_booking_settings,public.studio_rooms,public.studio_session_services,public.studio_opening_hours,public.studio_time_blocks,public.studio_bookings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.studio_booking_settings,public.studio_rooms,public.studio_session_services,public.studio_opening_hours,public.studio_time_blocks,public.studio_bookings TO authenticated,service_role;

CREATE FUNCTION studio_booking_private.catalog(p_handle TEXT) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w public.studio_workspaces%ROWTYPE; cfg public.studio_booking_settings%ROWTYPE; profile public.users_profiles%ROWTYPE;
BEGIN
 IF length(COALESCE(p_handle,'')) NOT BETWEEN 1 AND 100 THEN RETURN NULL; END IF;
 SELECT * INTO profile FROM public.users_profiles WHERE lower(handle)=lower(ltrim(p_handle,'@'));
 SELECT * INTO w FROM public.studio_workspaces WHERE owner_id=profile.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO cfg FROM public.studio_booking_settings WHERE studio_id=w.id;
 IF auth.uid() IS DISTINCT FROM w.owner_id AND (COALESCE(cfg.is_public,false)=false OR public.active_tier(w.owner_id)<>'PRO') THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',w.id,'name',w.name,'city',w.city,'timezone',w.timezone,'handle',profile.handle,
  'owner_id',w.owner_id,'producer_name',COALESCE(profile.display_name,profile.handle),
  'today',(now() AT TIME ZONE w.timezone)::DATE,'horizon_days',COALESCE(cfg.horizon_days,90),
  'notice_hours',COALESCE(cfg.notice_hours,12),'is_public',COALESCE(cfg.is_public,false),
  'services',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'description',s.description,'duration_minutes',s.duration_minutes,'buffer_minutes',s.buffer_minutes,'price_minor',s.price_minor,'room_name',r.name) ORDER BY s.created_at,s.id)
    FROM public.studio_session_services s JOIN public.studio_rooms r ON r.id=s.room_id WHERE r.studio_id=w.id AND s.is_active),'[]'::JSONB));
END; $$;

-- A bounded one-day projection: returns free times only, never calendar/client details.
CREATE FUNCTION studio_booking_private.slots(p_service UUID,p_day DATE) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s public.studio_session_services%ROWTYPE; r public.studio_rooms%ROWTYPE; w public.studio_workspaces%ROWTYPE;
 cfg public.studio_booking_settings%ROWTYPE; h public.studio_opening_hours%ROWTYPE; first_time TIMESTAMPTZ; last_time TIMESTAMPTZ;
BEGIN
 IF p_day IS NULL THEN RETURN '[]'; END IF;
 SELECT * INTO s FROM public.studio_session_services WHERE id=p_service AND is_active;
 IF NOT FOUND THEN RETURN '[]'; END IF;
 SELECT * INTO r FROM public.studio_rooms WHERE id=s.room_id;
 SELECT * INTO w FROM public.studio_workspaces WHERE id=r.studio_id;
 SELECT * INTO cfg FROM public.studio_booking_settings WHERE studio_id=w.id;
 IF public.active_tier(w.owner_id)<>'PRO' OR (COALESCE(cfg.is_public,false)=false AND auth.uid() IS DISTINCT FROM w.owner_id)
  OR p_day<(now() AT TIME ZONE w.timezone)::DATE OR p_day>(now() AT TIME ZONE w.timezone)::DATE+COALESCE(cfg.horizon_days,90) THEN RETURN '[]'; END IF;
 SELECT * INTO h FROM public.studio_opening_hours WHERE room_id=r.id AND weekday=extract(dow FROM p_day)::INTEGER AND NOT closed;
 IF NOT FOUND THEN RETURN '[]'; END IF;
 first_time:=((p_day+h.opens) AT TIME ZONE w.timezone)+make_interval(mins=>s.buffer_minutes);
 last_time:=((p_day+h.closes) AT TIME ZONE w.timezone)-make_interval(mins=>s.duration_minutes+s.buffer_minutes);
 RETURN COALESCE((SELECT jsonb_agg(t ORDER BY t) FROM generate_series(first_time,last_time,interval '30 minutes') t
  WHERE t>now()+make_interval(hours=>CASE WHEN auth.uid()=w.owner_id THEN 0 ELSE COALESCE(cfg.notice_hours,12) END)
  AND NOT EXISTS(SELECT 1 FROM public.studio_bookings b WHERE b.room_id=r.id AND (b.status='CONFIRMED' OR (b.status='RESERVED' AND b.reserved_until>now()))
    AND b.starts_at-make_interval(mins=>b.buffer_minutes)<t+make_interval(mins=>s.duration_minutes+s.buffer_minutes)
    AND b.ends_at+make_interval(mins=>b.buffer_minutes)>t-make_interval(mins=>s.buffer_minutes))
  AND NOT EXISTS(SELECT 1 FROM public.studio_time_blocks b WHERE b.room_id=r.id AND b.is_active
    AND b.starts_at<t+make_interval(mins=>s.duration_minutes+s.buffer_minutes) AND b.ends_at>t-make_interval(mins=>s.buffer_minutes))),'[]'::JSONB);
END; $$;

CREATE FUNCTION studio_booking_private.command(p_action TEXT,p_payload JSONB) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor UUID:=auth.uid(); w public.studio_workspaces%ROWTYPE; r public.studio_rooms%ROWTYPE; s public.studio_session_services%ROWTYPE;
 b public.studio_bookings%ROWTYPE; client public.users_profiles%ROWTYPE; v_id UUID; project UUID; start_time TIMESTAMPTZ; end_time TIMESTAMPTZ;
 row_data JSONB; reason TEXT; slots JSONB;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::TEXT)>15000 THEN RAISE EXCEPTION 'Invalid booking request'; END IF;
 IF NOT public.consume_request_limit('studio-booking:'||actor,20,60) THEN RAISE EXCEPTION 'Please wait a minute before making more changes'; END IF;
 SELECT * INTO w FROM public.studio_workspaces WHERE owner_id=actor;
 IF p_action IN('create_room','create_service','save_hours','publish','toggle_service','block_time','unblock_time') THEN
  IF w.id IS NULL OR public.active_tier(actor)<>'PRO' THEN RAISE EXCEPTION 'Active PRO studio ownership required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.studio_booking_settings(studio_id) VALUES(w.id) ON CONFLICT DO NOTHING;
  IF p_action='create_room' THEN
   IF (SELECT count(*) FROM public.studio_rooms WHERE studio_id=w.id)>=10 THEN RAISE EXCEPTION 'Maximum 10 rooms'; END IF;
   INSERT INTO public.studio_rooms(studio_id,name) VALUES(w.id,trim(p_payload->>'name')) RETURNING id INTO v_id;
   INSERT INTO public.studio_opening_hours(room_id,weekday,closed) SELECT v_id,n,n IN(0,6) FROM generate_series(0,6) n;
  ELSIF p_action='publish' THEN
   IF p_payload->'is_public' NOT IN('true'::JSONB,'false'::JSONB) OR p_payload->'is_public' IS NULL THEN RAISE EXCEPTION 'Choose booking visibility'; END IF;
   IF p_payload->'is_public'='true'::JSONB AND NOT EXISTS(SELECT 1 FROM public.studio_session_services x JOIN public.studio_rooms y ON y.id=x.room_id JOIN public.studio_opening_hours h ON h.room_id=y.id AND NOT h.closed WHERE y.studio_id=w.id AND x.is_active) THEN RAISE EXCEPTION 'Add an active service and opening hours first'; END IF;
   UPDATE public.studio_booking_settings SET is_public=(p_payload->>'is_public')::BOOLEAN,notice_hours=(p_payload->>'notice_hours')::INTEGER,horizon_days=(p_payload->>'horizon_days')::INTEGER WHERE studio_id=w.id;
  ELSE
   IF p_action='toggle_service' THEN SELECT room_id INTO v_id FROM public.studio_session_services WHERE id=(p_payload->>'service_id')::UUID;
   ELSE v_id:=(p_payload->>'room_id')::UUID; END IF;
   SELECT * INTO r FROM public.studio_rooms WHERE id=v_id AND studio_id=w.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable' USING ERRCODE='42501'; END IF;
   IF p_action='create_service' THEN
    IF (SELECT count(*) FROM public.studio_session_services x JOIN public.studio_rooms y ON y.id=x.room_id WHERE y.studio_id=w.id)>=40 THEN RAISE EXCEPTION 'Maximum 40 services'; END IF;
    INSERT INTO public.studio_session_services(room_id,title,description,duration_minutes,buffer_minutes,price_minor,service_type)
     VALUES(r.id,trim(p_payload->>'title'),trim(COALESCE(p_payload->>'description','')),(p_payload->>'duration_minutes')::INTEGER,(p_payload->>'buffer_minutes')::INTEGER,(p_payload->>'price_minor')::BIGINT,COALESCE(p_payload->>'service_type','RECORDING')) RETURNING id INTO v_id;
   ELSIF p_action='toggle_service' THEN
    IF p_payload->'is_active' NOT IN('true'::JSONB,'false'::JSONB) OR p_payload->'is_active' IS NULL THEN RAISE EXCEPTION 'Choose service visibility'; END IF;
    UPDATE public.studio_session_services SET is_active=(p_payload->>'is_active')::BOOLEAN WHERE id=(p_payload->>'service_id')::UUID AND room_id=r.id;
   ELSIF p_action='save_hours' THEN
    IF jsonb_typeof(p_payload->'weekly') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'weekly')<>7 THEN RAISE EXCEPTION 'Provide all seven weekdays'; END IF;
    IF (SELECT count(DISTINCT (x->>'weekday')::INTEGER) FROM jsonb_array_elements(p_payload->'weekly') x)<>7 THEN RAISE EXCEPTION 'Each weekday must appear once'; END IF;
    FOR row_data IN SELECT value FROM jsonb_array_elements(p_payload->'weekly') LOOP
     INSERT INTO public.studio_opening_hours(room_id,weekday,opens,closes,closed)
      VALUES(r.id,(row_data->>'weekday')::INTEGER,(row_data->>'opens')::TIME,(row_data->>'closes')::TIME,(row_data->>'closed')::BOOLEAN)
      ON CONFLICT(room_id,weekday) DO UPDATE SET opens=EXCLUDED.opens,closes=EXCLUDED.closes,closed=EXCLUDED.closed;
    END LOOP;
   ELSIF p_action='unblock_time' THEN
    UPDATE public.studio_time_blocks SET is_active=false WHERE id=(p_payload->>'block_id')::UUID AND room_id=r.id;
   ELSIF p_action='block_time' THEN
    start_time:=(p_payload->>'starts_local')::TIMESTAMP AT TIME ZONE w.timezone; end_time:=(p_payload->>'ends_local')::TIMESTAMP AT TIME ZONE w.timezone;
    IF end_time<=start_time OR end_time IS NULL OR start_time IS NULL THEN RAISE EXCEPTION 'Choose a valid time range'; END IF;
    IF EXISTS(SELECT 1 FROM public.studio_bookings x WHERE x.room_id=r.id AND (x.status='CONFIRMED' OR (x.status='RESERVED' AND x.reserved_until>now())) AND x.starts_at-make_interval(mins=>x.buffer_minutes)<end_time AND x.ends_at+make_interval(mins=>x.buffer_minutes)>start_time) THEN RAISE EXCEPTION 'This time overlaps an existing reservation'; END IF;
    INSERT INTO public.studio_time_blocks(room_id,starts_at,ends_at,reason) VALUES(r.id,start_time,end_time,trim(p_payload->>'reason')) RETURNING id INTO v_id;
   END IF;
  END IF;
  RETURN jsonb_build_object('id',COALESCE(v_id,w.id));
 END IF;
 IF p_action IN('request','manual_booking') THEN
  SELECT * INTO s FROM public.studio_session_services WHERE id=(p_payload->>'service_id')::UUID AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service unavailable'; END IF;
  SELECT * INTO r FROM public.studio_rooms WHERE id=s.room_id FOR UPDATE;
  SELECT * INTO w FROM public.studio_workspaces WHERE id=r.studio_id;
  IF public.active_tier(w.owner_id)<>'PRO' THEN RAISE EXCEPTION 'Studio is not accepting bookings'; END IF;
  IF p_action='manual_booking' THEN
   IF actor<>w.owner_id THEN RAISE EXCEPTION 'Studio owner access required' USING ERRCODE='42501'; END IF;
   SELECT * INTO client FROM public.users_profiles WHERE lower(handle)=lower(ltrim(trim(p_payload->>'artist_handle'),'@')) AND id<>actor;
  ELSE SELECT * INTO client FROM public.users_profiles WHERE id=actor AND id<>w.owner_id; END IF;
  IF client.id IS NULL THEN RAISE EXCEPTION 'Choose another registered artist or producer'; END IF;
  start_time:=(p_payload->>'starts_at')::TIMESTAMPTZ;
  slots:=studio_booking_private.slots(s.id,(start_time AT TIME ZONE w.timezone)::DATE);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(slots) x WHERE x::TIMESTAMPTZ=start_time) THEN RAISE EXCEPTION 'That time is no longer available. Choose another slot'; END IF;
  end_time:=start_time+make_interval(mins=>s.duration_minutes);
  INSERT INTO public.studio_bookings(studio_id,room_id,service_id,producer_id,artist_id,starts_at,ends_at,buffer_minutes,notes,service_snapshot)
   VALUES(w.id,r.id,s.id,w.owner_id,client.id,start_time,end_time,s.buffer_minutes,trim(COALESCE(p_payload->>'notes','')),
    jsonb_build_object('title',s.title,'description',s.description,'service_type',s.service_type,'price_minor',s.price_minor,'currency','GHS','duration_minutes',s.duration_minutes,'buffer_minutes',s.buffer_minutes,'room_name',r.name,'studio_name',w.name,'timezone',w.timezone)) RETURNING * INTO b;
  IF p_action='request' THEN
   INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(w.owner_id,'studio_booking','New studio booking request',s.title,'/dashboard/studio');
   RETURN jsonb_build_object('id',b.id);
  END IF;
  -- Manual bookings follow the same reservation/project path as accepted requests.
  p_action:='reserve'; p_payload:=jsonb_build_object('booking_id',b.id);
 ELSE
  SELECT room_id INTO v_id FROM public.studio_bookings WHERE id=(p_payload->>'booking_id')::UUID AND actor IN(producer_id,artist_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking unavailable' USING ERRCODE='42501'; END IF;
  -- All allocation writers lock room first, then booking; agreement trigger follows
  -- the same order. Cancellation does not acquire a project row lock.
  SELECT * INTO r FROM public.studio_rooms WHERE id=v_id FOR UPDATE;
  SELECT * INTO b FROM public.studio_bookings WHERE id=(p_payload->>'booking_id')::UUID FOR UPDATE;
  SELECT * INTO w FROM public.studio_workspaces WHERE id=b.studio_id;
 END IF;
 IF p_action='reserve' THEN
  IF actor<>b.producer_id OR public.active_tier(actor)<>'PRO' THEN RAISE EXCEPTION 'Active PRO studio owner required' USING ERRCODE='42501'; END IF;
  IF b.status='RESERVED' AND b.reserved_until>now() THEN RETURN jsonb_build_object('id',b.id,'project_id',b.project_id); END IF;
  IF b.status<>'REQUESTED' AND NOT(b.status='RESERVED' AND b.reserved_until<=now()) THEN RAISE EXCEPTION 'This booking cannot be reserved'; END IF;
  IF b.starts_at<=now() OR EXISTS(SELECT 1 FROM public.studio_bookings x WHERE x.room_id=b.room_id AND x.id<>b.id AND (x.status='CONFIRMED' OR (x.status='RESERVED' AND x.reserved_until>now())) AND x.starts_at-make_interval(mins=>x.buffer_minutes)<b.ends_at+make_interval(mins=>b.buffer_minutes) AND x.ends_at+make_interval(mins=>x.buffer_minutes)>b.starts_at-make_interval(mins=>b.buffer_minutes)) OR EXISTS(SELECT 1 FROM public.studio_time_blocks x WHERE x.room_id=b.room_id AND x.is_active AND x.starts_at<b.ends_at+make_interval(mins=>b.buffer_minutes) AND x.ends_at>b.starts_at-make_interval(mins=>b.buffer_minutes)) THEN RAISE EXCEPTION 'This time is already taken. Ask the artist to choose another slot'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.studio_session_services WHERE id=b.service_id AND is_active) THEN RAISE EXCEPTION 'This service is no longer active'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.studio_opening_hours h WHERE h.room_id=b.room_id AND h.weekday=extract(dow FROM (b.starts_at AT TIME ZONE w.timezone))::INTEGER AND NOT h.closed
   AND b.starts_at-make_interval(mins=>b.buffer_minutes)>=(((b.starts_at AT TIME ZONE w.timezone)::DATE+h.opens) AT TIME ZONE w.timezone)
   AND b.ends_at+make_interval(mins=>b.buffer_minutes)<=(((b.starts_at AT TIME ZONE w.timezone)::DATE+h.closes) AT TIME ZONE w.timezone)) THEN RAISE EXCEPTION 'This request is outside the room opening hours'; END IF;
  project:=b.project_id;
  IF project IS NULL THEN
   INSERT INTO public.studio_projects(studio_id,producer_id,artist_id,title,service_type,brief)
    VALUES(b.studio_id,b.producer_id,b.artist_id,b.service_snapshot->>'title',COALESCE(b.service_snapshot->>'service_type','RECORDING'),'Studio session: '||(b.service_snapshot->>'title')||E'\n'||COALESCE(b.notes,'')) RETURNING id INTO project;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(project,actor,'BOOKING_RESERVED','A studio session has been reserved. Confirm the scope and agreement together.');
  END IF;
  UPDATE public.studio_bookings SET status='RESERVED',project_id=project,reserved_until=least(now()+interval '24 hours',starts_at),updated_at=now() WHERE id=b.id;
  INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(b.artist_id,'studio_booking','Studio session reserved','Review the agreement with your producer to confirm the session.','/dashboard/projects/'||project);
 ELSIF p_action IN('decline','cancel','withdraw','complete') THEN
  reason:=trim(COALESCE(p_payload->>'reason',''));
  IF p_action='withdraw' THEN
   IF actor<>b.artist_id OR b.status<>'REQUESTED' THEN RAISE EXCEPTION 'Only a pending request can be withdrawn by its artist'; END IF;
  ELSE
   IF actor<>b.producer_id THEN RAISE EXCEPTION 'Studio owner access required' USING ERRCODE='42501'; END IF;
   IF p_action='decline' AND b.status<>'REQUESTED' THEN RAISE EXCEPTION 'Only pending requests can be declined'; END IF;
   IF p_action='cancel' AND b.status NOT IN('RESERVED','CONFIRMED') THEN RAISE EXCEPTION 'Booking is not reserved or confirmed'; END IF;
   IF p_action='complete' AND (b.status<>'CONFIRMED' OR b.ends_at>now()) THEN RAISE EXCEPTION 'Only a finished confirmed session can be marked complete'; END IF;
  END IF;
  IF p_action<>'complete' AND length(reason) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Provide a reason (5 to 1000 characters)'; END IF;
  UPDATE public.studio_bookings SET status=CASE p_action WHEN 'decline' THEN 'DECLINED' WHEN 'complete' THEN 'COMPLETED' ELSE 'CANCELLED' END,outcome_reason=reason,updated_at=now() WHERE id=b.id;
  INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(CASE WHEN actor=b.producer_id THEN b.artist_id ELSE b.producer_id END,'studio_booking','Studio booking updated',CASE WHEN p_action='complete' THEN 'Session marked complete.' ELSE reason END,CASE WHEN actor=b.producer_id THEN '/dashboard/bookings' ELSE '/dashboard/studio' END);
 ELSE RAISE EXCEPTION 'Unknown booking action'; END IF;
 RETURN jsonb_build_object('id',b.id,'project_id',project);
END; $$;

-- Agreement acceptance confirms only the associated live reservation. A late
-- agreement cannot resurrect an expired/cancelled slot or displace another artist.
CREATE FUNCTION studio_booking_private.confirm_agreement() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b public.studio_bookings%ROWTYPE; room UUID;
BEGIN
 IF NEW.active_agreement_id IS NULL OR NEW.active_agreement_id IS NOT DISTINCT FROM OLD.active_agreement_id THEN RETURN NEW; END IF;
 SELECT room_id INTO room FROM public.studio_bookings WHERE project_id=NEW.id AND (status='RESERVED' OR OLD.active_agreement_id IS NULL);
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.studio_rooms WHERE id=room FOR UPDATE;
 SELECT * INTO b FROM public.studio_bookings WHERE project_id=NEW.id FOR UPDATE;
 IF OLD.active_agreement_id IS NULL AND b.status NOT IN('RESERVED','CONFIRMED') THEN RAISE EXCEPTION 'This booking was cancelled. Request a new session before confirming an agreement'; END IF;
 IF b.status<>'RESERVED' THEN RETURN NEW; END IF;
 IF b.reserved_until<=now() OR b.starts_at<=now() THEN RAISE EXCEPTION 'Booking reservation expired. Ask the producer to reserve the time again'; END IF;
 UPDATE public.studio_bookings SET status='CONFIRMED',updated_at=now() WHERE id=b.id;
 RETURN NEW;
END; $$;
CREATE TRIGGER studio_booking_agreement AFTER UPDATE OF active_agreement_id ON public.studio_projects FOR EACH ROW EXECUTE FUNCTION studio_booking_private.confirm_agreement();

REVOKE ALL ON FUNCTION studio_booking_private.catalog(TEXT),studio_booking_private.slots(UUID,DATE),studio_booking_private.command(TEXT,JSONB),studio_booking_private.confirm_agreement() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION studio_booking_private.catalog(TEXT),studio_booking_private.slots(UUID,DATE) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION studio_booking_private.command(TEXT,JSONB) TO authenticated;
CREATE FUNCTION public.studio_booking_catalog(p_handle TEXT) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT studio_booking_private.catalog(p_handle) $$;
CREATE FUNCTION public.studio_booking_slots(p_service UUID,p_day DATE) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT studio_booking_private.slots(p_service,p_day) $$;
CREATE FUNCTION public.studio_booking_command(p_action TEXT,p_payload JSONB) RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$ SELECT studio_booking_private.command(p_action,p_payload) $$;
REVOKE ALL ON FUNCTION public.studio_booking_catalog(TEXT),public.studio_booking_slots(UUID,DATE),public.studio_booking_command(TEXT,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.studio_booking_catalog(TEXT),public.studio_booking_slots(UUID,DATE) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.studio_booking_command(TEXT,JSONB) TO authenticated;
COMMIT;
