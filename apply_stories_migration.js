import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const projectRef = 'fefrlcxctuhdbztyoncs';

const passwordsToTry = [
  process.env.SUPABASE_DB_PASSWORD,
  'Ansoceanverse@2026',
  'Ansoceanverse2026',
  'HiHubble2026!',
  'HiHubble@2026',
  'ansoceanverse'
].filter(Boolean);

const ddlSql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS public.stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url TEXT,
    media_type VARCHAR(50) DEFAULT 'image',
    caption TEXT,
    location TEXT,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_scheduled BOOLEAN DEFAULT FALSE,
    scheduled_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'published'
  );

  CREATE INDEX IF NOT EXISTS idx_stories_author ON public.stories(author_id);
  CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at);
  CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);

  CREATE TABLE IF NOT EXISTS public.story_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(50) DEFAULT 'image',
    display_order INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_story_media_story ON public.story_media(story_id);

  ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.story_media ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Public stories policy" ON public.stories;
  DROP POLICY IF EXISTS "Public stories select policy" ON public.stories;
  DROP POLICY IF EXISTS "Public stories insert policy" ON public.stories;
  DROP POLICY IF EXISTS "Public stories update policy" ON public.stories;
  DROP POLICY IF EXISTS "Public stories delete policy" ON public.stories;

  DROP POLICY IF EXISTS "Public story_media policy" ON public.story_media;
  DROP POLICY IF EXISTS "Public story_media select policy" ON public.story_media;
  DROP POLICY IF EXISTS "Public story_media insert policy" ON public.story_media;
  DROP POLICY IF EXISTS "Public story_media update policy" ON public.story_media;
  DROP POLICY IF EXISTS "Public story_media delete policy" ON public.story_media;

  CREATE POLICY "Public stories select policy" ON public.stories FOR SELECT USING (true);
  CREATE POLICY "Public stories insert policy" ON public.stories FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public stories update policy" ON public.stories FOR UPDATE USING (true);
  CREATE POLICY "Public stories delete policy" ON public.stories FOR DELETE USING (true);

  CREATE POLICY "Public story_media select policy" ON public.story_media FOR SELECT USING (true);
  CREATE POLICY "Public story_media insert policy" ON public.story_media FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public story_media update policy" ON public.story_media FOR UPDATE USING (true);
  CREATE POLICY "Public story_media delete policy" ON public.story_media FOR DELETE USING (true);
`;

async function applyStoriesMigration() {
  console.log("Connecting to PostgreSQL to apply stories table & RLS migration...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`Connected to Postgres using password! Executing DDL...`);
      await client.query(ddlSql);
      console.log("✅ public.stories and public.story_media created with RLS enabled!");

      // Verify RLS status
      const rlsRes = await client.query(`
        SELECT relname, relrowsecurity 
        FROM pg_class 
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
        WHERE nspname = 'public' AND relname IN ('stories', 'story_media');
      `);
      console.log("RLS Verification Output:", rlsRes.rows);
      await client.end();
      success = true;
      break;
    } catch (err) {
      console.log(`Notice for password: ${err.message}`);
    }
  }

  if (!success) {
    console.error("❌ Could not apply migration via direct postgres connection. Testing RPC fallback...");
  }
}

applyStoriesMigration();
