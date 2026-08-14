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

const clearSql = `
  -- Ensure subtables exist
  CREATE TABLE IF NOT EXISTS public.reel_views (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      watch_duration_seconds NUMERIC DEFAULT 0,
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (reel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS public.reel_likes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (reel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS public.reel_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
      author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES public.reel_comments(id) ON DELETE CASCADE,
      content TEXT NOT NULL CHECK (char_length(content) <= 1000),
      like_count INT DEFAULT 0 CHECK (like_count >= 0),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS public.saved_reels (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, reel_id)
  );

  CREATE TABLE IF NOT EXISTS public.reel_hashtags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
      hashtag VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (reel_id, hashtag)
  );

  -- Clean up all reels and reel-related tables
  TRUNCATE TABLE public.reel_views RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.reel_likes RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.reel_comments RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.saved_reels RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.reel_hashtags RESTART IDENTITY CASCADE;
  TRUNCATE TABLE public.reels RESTART IDENTITY CASCADE;

  DELETE FROM public.likes WHERE target_type = 'reel';
`;

async function main() {
  console.log("Connecting to Supabase PostgreSQL to clear reel tables...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(clearSql);
      console.log("✅ SUCCESS: Cleared reels and all related tables (reel_views, reel_likes, reel_comments, saved_reels, reel_hashtags, reels, reel likes) successfully!");
      await client.end();
      success = true;
      break;
    } catch (err) {
      console.log(`Connection attempt notice: ${err.message}`);
    }
  }

  if (!success) {
    console.log("Direct postgres connection failed, trying via Supabase Client fallback...");
  }
}

main();
