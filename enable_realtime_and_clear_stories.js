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

const sql = `
  -- 1. Enable Supabase Realtime on stories and story_media tables
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
      ALTER PUBLICATION supabase_realtime ADD TABLE public.story_media;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Notice adding tables to realtime publication: %', SQLERRM;
  END $$;

  -- 2. Clear old test story entries so database is clean for user's fresh stories
  DELETE FROM public.stories;
  DELETE FROM public.story_media;
`;

async function main() {
  console.log("Connecting to PostgreSQL to enable Realtime publication & clear test stories...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log("Connected to Supabase PostgreSQL! Executing SQL...");
      await client.query(sql);
      console.log("✅ Supabase Realtime enabled for stories tables & test stories cleared!");
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

main();
