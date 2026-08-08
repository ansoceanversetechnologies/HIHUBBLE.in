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

    const res = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Tables and Views in public schema:");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
