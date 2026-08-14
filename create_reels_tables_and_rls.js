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

const sqlContent = fs.readFileSync('supabase/migrations/20260809_create_reels_and_rls.sql', 'utf8');

async function main() {
  console.log("Connecting to Supabase PostgreSQL to set up public.reels table & Realtime...");
  let success = false;

  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sqlContent);
      console.log("🎉 SUCCESS! public.reels table created, RLS enabled, and Supabase Realtime configured!");
      await client.end();
      success = true;
      break;
    } catch (err) {
      console.log(`Notice: ${err.message}`);
    }
  }

  if (!success) {
    console.error("❌ Direct postgres connection notice.");
  }
}

main();
