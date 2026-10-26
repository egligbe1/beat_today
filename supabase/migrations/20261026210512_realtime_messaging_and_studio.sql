-- Review and specific approval required before applying to production.
-- Enables change delivery for existing, RLS-protected records. No rows are changed.
BEGIN;
DO $$
DECLARE name TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  RAISE EXCEPTION 'supabase_realtime publication is missing; no changes applied';
 END IF;
 FOREACH name IN ARRAY ARRAY['messages','conversations','notifications','studio_project_events','studio_projects','studio_agreements','studio_bookings','studio_project_milestones'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=name AND c.relkind='r' AND c.relrowsecurity) THEN
   RAISE EXCEPTION 'Required table public.% is missing or RLS is disabled; no changes applied',name;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=name AND cmd IN('SELECT','ALL')) THEN
   RAISE EXCEPTION 'Required SELECT policy on public.% is missing; no changes applied',name;
  END IF;
 END LOOP;
 -- Messaging writes already use the authenticated server API, which verifies
 -- participation. Prevent direct browser writes from changing conversation members
 -- or inserting into another participant's thread using historical broad policies.
 REVOKE INSERT,UPDATE,DELETE ON public.messages,public.conversations FROM PUBLIC,anon,authenticated;
 FOREACH name IN ARRAY ARRAY['messages','conversations','notifications','studio_project_events','studio_projects','studio_agreements','studio_bookings','studio_project_milestones'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=name) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',name);
  END IF;
 END LOOP;
END $$;
COMMIT;
