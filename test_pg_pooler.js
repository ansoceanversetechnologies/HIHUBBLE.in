import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const projectRef = 'fefrlcxctuhdbztyoncs';

const hosts = [
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-us-west-1.pooler.supabase.com`,
  `aws-0-ap-south-1.pooler.supabase.com`,
  `aws-0-eu-central-1.pooler.supabase.com`,
  `fefrlcxctuhdbztyoncs.supabase.co`
];

async function testPoolers() {
  const pwd = process.env.SUPABASE_DB_PASSWORD || 'Ansoceanverse@2026';
  for (const host of hosts) {
    for (const port of [5432, 6543]) {
      const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(pwd)}@${host}:${port}/postgres`;
      const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
      try {
        console.log(`Connecting to ${host}:${port}...`);
        await client.connect();
        console.log(`🎉 SUCCESS connecting to ${host}:${port}!`);
        await client.end();
        return;
      } catch (err) {
        console.log(`Host ${host}:${port} error:`, err.message);
        await client.end().catch(() => {});
      }
    }
  }
}

testPoolers();
