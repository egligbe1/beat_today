import {readFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
const root=new URL('../../supabase/migrations/',import.meta.url)
export async function marketplaceFixture(t,options={}){
  const {PGlite}=await import(process.env.PGLITE_MODULE_PATH ? pathToFileURL(process.env.PGLITE_MODULE_PATH).href : '@electric-sql/pglite')
  const db=await PGlite.create();t.after(()=>db.close())
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT current_setting('role',true) $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN);
    CREATE TABLE storage.objects(id UUID,bucket_id TEXT,owner UUID);
  `)
  for(const file of ['001_core_identity.sql','002_catalog_and_storage.sql','003_financial_engine.sql','004_marketplace_and_licenses.sql','005_engagement_and_optimization.sql','006_permissions_and_sync.sql','007_status_alignment.sql','009_create_search_view.sql','010_add_subscription_reference.sql','015_rename_reviews_table.sql','016_auto_producer_settings.sql','017_add_updated_at_reviews.sql','018_unique_reviews.sql','029_collaborated_splits.sql','030_negotiations.sql','031_producer_services.sql','032_email_gates.sql','033_beat_comments.sql','035_perf_denormalization.sql','036_fix_auth_onboarding.sql','037_ensure_play_count_permissions.sql','038_financial_and_security_hardening.sql','039_restrict_financial_access.sql','20261026154145_marketplace_integrity.sql']) {
    try {await db.exec(await readFile(new URL(file,root),'utf8'))}catch(e){throw new Error(`${file}: ${e.message}`,{cause:e})}
  }
  if(options.guestCheckout){await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at TIMESTAMPTZ');await db.exec(await readFile(new URL('20261101161606_guest_license_checkout.sql',root),'utf8'))}
  return db
}
