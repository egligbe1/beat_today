-- Studio workspace foundation. REVIEW/APPLY THIS FILE ONLY after explicit approval.
-- Additive: no changes to existing rows, money, licenses or storage objects.
BEGIN;
CREATE SCHEMA IF NOT EXISTS studio_private;
REVOKE ALL ON SCHEMA studio_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA studio_private TO authenticated;

CREATE TABLE public.studio_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.users_profiles(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
  city TEXT NOT NULL DEFAULT '' CHECK(length(city)<=100),
  timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES public.studio_workspaces(id),
  producer_id UUID NOT NULL REFERENCES public.users_profiles(id),
  artist_id UUID NOT NULL REFERENCES public.users_profiles(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 160),
  service_type TEXT NOT NULL CHECK(service_type IN ('RECORDING','MIXING','MASTERING','PRODUCTION')),
  brief TEXT NOT NULL CHECK(length(trim(brief)) BETWEEN 10 AND 8000),
  status TEXT NOT NULL DEFAULT 'AWAITING_AGREEMENT' CHECK(status IN ('AWAITING_AGREEMENT','AGREED','IN_PRODUCTION','ON_HOLD')),
  active_agreement_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(producer_id<>artist_id)
);
CREATE INDEX studio_projects_owner ON public.studio_projects(producer_id,updated_at DESC);
CREATE INDEX studio_projects_artist ON public.studio_projects(artist_id,updated_at DESC);
CREATE INDEX studio_projects_workspace ON public.studio_projects(studio_id);
CREATE TABLE public.studio_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.studio_projects(id),
  version INTEGER NOT NULL CHECK(version>0),
  status TEXT NOT NULL DEFAULT 'SENT' CHECK(status IN ('SENT','ACCEPTED','CHANGES_REQUESTED','SUPERSEDED')),
  terms JSONB NOT NULL CHECK(jsonb_typeof(terms)='object' AND octet_length(terms::TEXT)<=40000),
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  producer_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  artist_accepted_at TIMESTAMPTZ,
  changes_requested TEXT CHECK(length(changes_requested)<=4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id,version),
  UNIQUE(project_id,id),
  CHECK((status='ACCEPTED')=(artist_accepted_at IS NOT NULL))
);
ALTER TABLE public.studio_projects ADD CONSTRAINT studio_active_agreement
 FOREIGN KEY(id,active_agreement_id) REFERENCES public.studio_agreements(project_id,id);
CREATE TABLE public.studio_project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.studio_projects(id),
  actor_id UUID NOT NULL REFERENCES public.users_profiles(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 5000),
  agreement_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id,agreement_id) REFERENCES public.studio_agreements(project_id,id)
);
CREATE INDEX studio_events_project ON public.studio_project_events(project_id,created_at DESC,id);
CREATE TABLE public.studio_project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.studio_projects(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 160),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX studio_milestones_project ON public.studio_project_milestones(project_id,created_at);

ALTER TABLE public.studio_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY studio_workspace_read ON public.studio_workspaces FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()) OR id IN(SELECT studio_id FROM public.studio_projects WHERE artist_id=(SELECT auth.uid())));
CREATE POLICY studio_project_read ON public.studio_projects FOR SELECT TO authenticated
 USING(producer_id=(SELECT auth.uid()) OR artist_id=(SELECT auth.uid()));
CREATE POLICY studio_agreement_read ON public.studio_agreements FOR SELECT TO authenticated
 USING(project_id IN(SELECT id FROM public.studio_projects));
CREATE POLICY studio_event_read ON public.studio_project_events FOR SELECT TO authenticated
 USING(project_id IN(SELECT id FROM public.studio_projects));
CREATE POLICY studio_milestone_read ON public.studio_project_milestones FOR SELECT TO authenticated
 USING(project_id IN(SELECT id FROM public.studio_projects));
REVOKE ALL ON public.studio_workspaces,public.studio_projects,public.studio_agreements,
 public.studio_project_events,public.studio_project_milestones FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.studio_workspaces,public.studio_projects,public.studio_agreements,
 public.studio_project_events,public.studio_project_milestones TO authenticated,service_role;

-- Writes are atomic and derive identity only from the authenticated request.
-- Kept outside the exposed public schema; public entry point below is INVOKER.
CREATE FUNCTION studio_private.command(p_action TEXT,p_project UUID,p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 actor UUID:=auth.uid(); p public.studio_projects%ROWTYPE; w public.studio_workspaces%ROWTYPE;
 a public.studio_agreements%ROWTYPE; client public.users_profiles%ROWTYPE;
 actor_profile public.users_profiles%ROWTYPE; terms JSONB; v_id UUID; v_version INTEGER;
 amount BIGINT; deposit BIGINT; rounds INTEGER; k TEXT; note TEXT; state TEXT;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::TEXT)>50000 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 IF NOT public.consume_request_limit('studio:'||actor||':'||COALESCE(p_action,''),CASE WHEN p_action IN('create_project','publish_agreement') THEN 10 ELSE 40 END,60) THEN RAISE EXCEPTION 'Too many changes. Please wait a minute'; END IF;
 SELECT * INTO actor_profile FROM public.users_profiles WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complete your profile first'; END IF;
 IF p_action='create_studio' THEN
   IF actor_profile.role<>'producer' OR public.active_tier(actor)<>'PRO' THEN RAISE EXCEPTION 'Active PRO subscription required' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_payload->>'timezone') THEN RAISE EXCEPTION 'Choose a valid timezone'; END IF;
   INSERT INTO public.studio_workspaces(owner_id,name,city,timezone)
    VALUES(actor,trim(p_payload->>'name'),trim(COALESCE(p_payload->>'city','')),p_payload->>'timezone') RETURNING id INTO v_id;
   RETURN jsonb_build_object('id',v_id);
 END IF;
 IF p_action='create_project' THEN
   IF actor_profile.role<>'producer' OR public.active_tier(actor)<>'PRO' THEN RAISE EXCEPTION 'Active PRO subscription required' USING ERRCODE='42501'; END IF;
   SELECT * INTO w FROM public.studio_workspaces WHERE owner_id=actor;
   IF NOT FOUND THEN RAISE EXCEPTION 'Set up your studio first'; END IF;
   SELECT * INTO client FROM public.users_profiles WHERE lower(handle)=lower(ltrim(trim(p_payload->>'artist_handle'),'@'));
   IF NOT FOUND OR client.id=actor OR client.role NOT IN ('artist','producer') THEN RAISE EXCEPTION 'Choose another registered artist or producer by handle'; END IF;
   INSERT INTO public.studio_projects(studio_id,producer_id,artist_id,title,service_type,brief)
    VALUES(w.id,actor,client.id,trim(p_payload->>'title'),p_payload->>'service_type',trim(p_payload->>'brief')) RETURNING id INTO v_id;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(v_id,actor,'PROJECT_CREATED','Project opened. The agreement is ready to be prepared.');
   INSERT INTO public.notifications(user_id,type,title,body,link) VALUES(client.id,'studio_project','New studio project',trim(p_payload->>'title'),'/dashboard/projects/'||v_id);
   RETURN jsonb_build_object('id',v_id);
 END IF;
 SELECT * INTO p FROM public.studio_projects WHERE id=p_project FOR UPDATE;
 IF NOT FOUND OR actor NOT IN(p.producer_id,p.artist_id) THEN RAISE EXCEPTION 'Project unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM public.studio_workspaces WHERE id=p.studio_id;
 IF p_action='publish_agreement' THEN
   IF actor<>p.producer_id THEN RAISE EXCEPTION 'Only the producer can publish an agreement' USING ERRCODE='42501'; END IF;
   IF p.active_agreement_id IS NULL AND public.active_tier(p.producer_id)<>'PRO' THEN RAISE EXCEPTION 'Active PRO subscription required' USING ERRCODE='42501'; END IF;
   IF p_payload->'confirmed' IS DISTINCT FROM 'true'::JSONB THEN RAISE EXCEPTION 'Confirm the agreement before sending'; END IF;
   -- Prevent an old editor tab from overwriting a newer proposal or acceptance.
   SELECT COALESCE(max(version),0) INTO v_version FROM public.studio_agreements WHERE project_id=p.id;
   IF (p_payload->>'expected_version')::INTEGER IS DISTINCT FROM v_version THEN RAISE EXCEPTION 'Agreement changed. Refresh the project before sending'; END IF;
   FOR k IN SELECT unnest(ARRAY['scope','deliverables','timeline','payment_terms','rights','cancellation']) LOOP
     IF length(trim(COALESCE(p_payload->>k,''))) NOT BETWEEN 10 AND 5000 THEN RAISE EXCEPTION 'Complete % (10 to 5000 characters)',k; END IF;
   END LOOP;
   amount:=(p_payload->>'total_minor')::BIGINT; deposit:=(p_payload->>'deposit_minor')::BIGINT; rounds:=(p_payload->>'revision_rounds')::INTEGER;
   IF amount IS NULL OR amount NOT BETWEEN 0 AND 100000000 OR deposit IS NULL OR deposit NOT BETWEEN 0 AND amount OR rounds IS NULL OR rounds NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'Check the price, deposit and revision allowance'; END IF;
   SELECT * INTO client FROM public.users_profiles WHERE id=p.artist_id;
   terms:=jsonb_build_object('scope',trim(p_payload->>'scope'),'deliverables',trim(p_payload->>'deliverables'),
    'timeline',trim(p_payload->>'timeline'),'payment_terms',trim(p_payload->>'payment_terms'),'rights',trim(p_payload->>'rights'),
    'cancellation',trim(p_payload->>'cancellation'),'milestones',COALESCE((SELECT jsonb_agg(jsonb_build_object('title',title,'due_date',due_date) ORDER BY created_at,id) FROM public.studio_project_milestones WHERE project_id=p.id),'[]'::JSONB),'total_minor',amount,'deposit_minor',deposit,'currency','GHS',
    'revision_rounds',rounds,'project_title',p.title,'producer_id',p.producer_id,'artist_id',p.artist_id,
    'producer_name',COALESCE(actor_profile.display_name,actor_profile.handle),'artist_name',COALESCE(client.display_name,client.handle),'studio_name',w.name);
   UPDATE public.studio_agreements SET status='SUPERSEDED' WHERE project_id=p.id AND status='SENT';
   INSERT INTO public.studio_agreements(project_id,version,terms,content_hash)
    VALUES(p.id,v_version+1,terms,encode(sha256(convert_to(terms::TEXT,'UTF8')),'hex')) RETURNING id INTO v_id;
   note:=CASE WHEN p.active_agreement_id IS NULL THEN 'Agreement' ELSE 'Proposed amendment' END||' v'||(v_version+1)||' confirmed by the producer and sent for artist review.';
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body,agreement_id) VALUES(p.id,actor,'AGREEMENT_SENT',note,v_id);
 ELSIF p_action IN('accept_agreement','request_changes') THEN
   IF actor<>p.artist_id THEN RAISE EXCEPTION 'Only the artist can respond to this agreement' USING ERRCODE='42501'; END IF;
   SELECT * INTO a FROM public.studio_agreements WHERE id=(p_payload->>'agreement_id')::UUID AND project_id=p.id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Agreement unavailable'; END IF;
   IF p_action='accept_agreement' AND a.status='ACCEPTED' AND p.active_agreement_id=a.id THEN RETURN jsonb_build_object('id',p.id); END IF;
   IF a.status<>'SENT' THEN RAISE EXCEPTION 'This version is no longer awaiting review'; END IF;
   IF p.active_agreement_id IS NULL AND public.active_tier(p.producer_id)<>'PRO' THEN RAISE EXCEPTION 'Producer must renew PRO before starting a new agreement'; END IF;
   IF p_payload->>'content_hash' IS DISTINCT FROM a.content_hash THEN RAISE EXCEPTION 'Agreement changed. Review the current version'; END IF;
   IF p_action='accept_agreement' THEN
     IF p_payload->'confirmed' IS DISTINCT FROM 'true'::JSONB THEN RAISE EXCEPTION 'Confirm that you accept this exact agreement'; END IF;
     UPDATE public.studio_agreements SET status='ACCEPTED',artist_accepted_at=now() WHERE id=a.id;
     UPDATE public.studio_projects SET active_agreement_id=a.id,status=CASE WHEN status='AWAITING_AGREEMENT' THEN 'AGREED' ELSE status END WHERE id=p.id;
     note:='Agreement v'||a.version||' accepted by both parties.';
   ELSE
     note:=trim(p_payload->>'message');
     IF length(COALESCE(note,'')) NOT BETWEEN 10 AND 4000 THEN RAISE EXCEPTION 'Describe the requested changes (10 to 4000 characters)'; END IF;
     UPDATE public.studio_agreements SET status='CHANGES_REQUESTED',changes_requested=note WHERE id=a.id;
     note:='Changes requested for v'||a.version||': '||note;
   END IF;
   v_id:=a.id;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body,agreement_id) VALUES(p.id,actor,upper(p_action),note,a.id);
 ELSIF p_action='message' THEN
   note:=trim(p_payload->>'message');
   IF length(COALESCE(note,'')) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Write a message (up to 4000 characters)'; END IF;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(p.id,actor,'MESSAGE',note);
 ELSIF p_action='add_milestone' THEN
   IF actor<>p.producer_id THEN RAISE EXCEPTION 'Only the producer can add milestones' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM public.studio_agreements WHERE project_id=p.id) THEN RAISE EXCEPTION 'Milestones are frozen once an agreement is published'; END IF;
   IF public.active_tier(p.producer_id)<>'PRO' THEN RAISE EXCEPTION 'Active PRO subscription required'; END IF;
   IF (SELECT count(*) FROM public.studio_project_milestones WHERE project_id=p.id)>=30 THEN RAISE EXCEPTION 'Maximum 30 milestones per project'; END IF;
   INSERT INTO public.studio_project_milestones(project_id,title,due_date)
    VALUES(p.id,trim(p_payload->>'title'),nullif(p_payload->>'due_date','')::DATE);
   note:='Milestone added: '||trim(p_payload->>'title');
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(p.id,actor,'MILESTONE_ADDED',note);
 ELSIF p_action='complete_milestone' THEN
   IF actor<>p.producer_id OR p.active_agreement_id IS NULL THEN RAISE EXCEPTION 'An accepted agreement and producer access are required'; END IF;
   UPDATE public.studio_project_milestones SET completed_at=now() WHERE id=(p_payload->>'milestone_id')::UUID AND project_id=p.id AND completed_at IS NULL RETURNING title INTO note;
   IF NOT FOUND THEN RAISE EXCEPTION 'Milestone unavailable or already complete'; END IF;
   note:='Milestone completed: '||note;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(p.id,actor,'MILESTONE_COMPLETED',note);
 ELSIF p_action='set_status' THEN
   IF actor<>p.producer_id OR p.active_agreement_id IS NULL THEN RAISE EXCEPTION 'An accepted agreement and producer access are required'; END IF;
   state:=p_payload->>'status';
   IF state IS NULL OR state NOT IN('IN_PRODUCTION','ON_HOLD') THEN RAISE EXCEPTION 'Invalid project stage'; END IF;
   IF state=p.status THEN RETURN jsonb_build_object('id',p.id); END IF;
   UPDATE public.studio_projects SET status=state WHERE id=p.id;
   note:=CASE WHEN state='IN_PRODUCTION' THEN 'Production started or resumed.' ELSE 'Project placed on hold.' END;
   INSERT INTO public.studio_project_events(project_id,actor_id,kind,body) VALUES(p.id,actor,'STATUS_CHANGED',note);
 ELSE RAISE EXCEPTION 'Unknown studio action';
 END IF;
 UPDATE public.studio_projects SET updated_at=now() WHERE id=p.id;
 IF p_action IN('publish_agreement','accept_agreement','request_changes','message') THEN
   INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES(CASE WHEN actor=p.producer_id THEN p.artist_id ELSE p.producer_id END,'studio_project',p.title,
      CASE WHEN p_action='message' THEN 'New project message' ELSE note END,'/dashboard/projects/'||p.id);
 END IF;
 RETURN jsonb_build_object('id',p.id);
END; $$;
REVOKE ALL ON FUNCTION studio_private.command(TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION studio_private.command(TEXT,UUID,JSONB) TO authenticated;
CREATE FUNCTION public.studio_command(p_action TEXT,p_project UUID DEFAULT NULL,p_payload JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT studio_private.command(p_action,p_project,p_payload);
$$;
REVOKE ALL ON FUNCTION public.studio_command(TEXT,UUID,JSONB) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.studio_command(TEXT,UUID,JSONB) TO authenticated;
COMMIT;
