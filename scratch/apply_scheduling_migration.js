import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const dbPassword = "Ansoceanverse2026";
const projectRef = 'fefrlcxctuhdbztyoncs';

async function main() {
  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL!");

    const sqlScript = fs.readFileSync('supabase/migrations/20260728_add_scheduling.sql', 'utf8');
    console.log("Applying scheduling migration...");
    await client.query(sqlScript);
    console.log("🎉 Scheduling migration applied successfully!");
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  } finally {
    await client.end();
  }
}

main();
