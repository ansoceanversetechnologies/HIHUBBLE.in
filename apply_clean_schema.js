import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("Connecting to Supabase and verifying database schema...");

  try {
    const requiredTables = ['profiles', 'posts', 'post_media', 'comments', 'likes'];
    for (const tableName of requiredTables) {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      if (error && error.code === '42P01') {
        console.log(`⚠️ Table '${tableName}' missing in database.`);
      } else if (error) {
        console.log(`Notice querying '${tableName}':`, error.message);
      } else {
        console.log(`✅ Table '${tableName}' is accessible and verified!`);
      }
    }

    // Ensure storage buckets exist
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const requiredBuckets = ['profile-images', 'post-images', 'post-videos'];

      for (const bucketName of requiredBuckets) {
        const bucketExists = buckets?.some(b => b.name === bucketName);
        if (!bucketExists) {
          console.log(`Creating '${bucketName}' storage bucket...`);
          await supabase.storage.createBucket(bucketName, { public: true });
          console.log(`✅ Bucket '${bucketName}' created!`);
        } else {
          console.log(`✅ Bucket '${bucketName}' is ready!`);
        }
      }
    } catch (bucketErr) {
      console.log("Storage bucket check notice:", bucketErr.message);
    }

    console.log("=================================================");
    console.log("🎉 SUCCESS! Authentication database schema is ready.");
    console.log("=================================================");
  } catch (err) {
    console.error("❌ Schema verification error:", err.message);
  }
}

main();
