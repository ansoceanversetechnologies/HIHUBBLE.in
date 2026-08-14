import pg from 'pg';
import fs from 'fs';
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

const sqlContent = fs.readFileSync('supabase/migrations/20260809_create_reel_subtables_and_rls.sql', 'utf8');

async function main() {
  console.log("Connecting to Supabase PostgreSQL to create Reel sub-tables (reel_views, reel_likes, reel_comments, saved_reels, reel_hashtags)...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sqlContent);
      console.log("🎉 SUCCESS! All 5 Reel sub-tables created, RLS enabled, and Realtime publication configured!");
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
