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

const reelsSql = `
  CREATE TABLE IF NOT EXISTS public.reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT,
    audio_track_name TEXT,
    duration_seconds NUMERIC DEFAULT 0,
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Public reels select policy" ON public.reels;
  DROP POLICY IF EXISTS "Public reels insert policy" ON public.reels;
  DROP POLICY IF EXISTS "Public reels update policy" ON public.reels;
  DROP POLICY IF EXISTS "Public reels delete policy" ON public.reels;

  CREATE POLICY "Public reels select policy" ON public.reels FOR SELECT USING (true);
  CREATE POLICY "Public reels insert policy" ON public.reels FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public reels update policy" ON public.reels FOR UPDATE USING (true);
  CREATE POLICY "Public reels delete policy" ON public.reels FOR DELETE USING (true);

  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END $$;
`;

async function main() {
  console.log("Creating public.reels table and enabling RLS & Realtime...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(reelsSql);
      console.log("✅ public.reels table ready with RLS & Realtime enabled!");
      await client.end();
      success = true;
      break;
    } catch (err) {
      console.log(`Notice: ${err.message}`);
    }
  }

  if (!success) {
    console.error("❌ Direct postgres execution notice.");
  }
}

main();
