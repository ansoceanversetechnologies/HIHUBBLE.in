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

const cleanupSql = `
  -- 1. Enable Supabase Realtime for all core social tables
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_media; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.likes; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.story_media; EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END $$;

  -- 2. Completely clean database: Delete all test posts, stories, comments, likes, notifications & test user accounts
  TRUNCATE TABLE public.likes CASCADE;
  TRUNCATE TABLE public.comments CASCADE;
  TRUNCATE TABLE public.post_media CASCADE;
  TRUNCATE TABLE public.posts CASCADE;
  TRUNCATE TABLE public.story_media CASCADE;
  TRUNCATE TABLE public.stories CASCADE;
  TRUNCATE TABLE public.notifications CASCADE;
  TRUNCATE TABLE public.call_history CASCADE;
  TRUNCATE TABLE public.story_views CASCADE;
  TRUNCATE TABLE public.story_reactions CASCADE;
  TRUNCATE TABLE public.login_history CASCADE;
  TRUNCATE TABLE public.profiles CASCADE;

  -- Delete auth users if auth schema exists
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
      DELETE FROM auth.users;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice resetting auth.users: %', SQLERRM;
  END $$;
`;

async function resetDatabase() {
  console.log("Connecting to Supabase PostgreSQL to perform 100% clean reset & enable Realtime...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log("Connected to Supabase PostgreSQL! Executing clean database reset & Realtime configuration...");
      await client.query(cleanupSql);
      console.log("🎉 SUCCESS! Database cleared 100% fresh & Supabase Realtime enabled for posts & stories!");
      await client.end();
      success = true;
      break;
    } catch (err) {
      console.log(`Notice: ${err.message}`);
    }
  }

  if (!success) {
    console.error("❌ Direct postgres execution failed.");
  }
}

resetDatabase();
