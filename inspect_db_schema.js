import { supabase } from './supabase.js';

async function inspectSchema() {
  console.log("--- INSPECTING SUPABASE DB SCHEMA ---");

  const tables = ['profiles', 'posts', 'post_media', 'comments', 'likes', 'notifications'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}' error:`, error.message, "(code:", error.code, ")");
    } else {
      console.log(`Table '${table}' columns:`, data.length > 0 ? Object.keys(data[0]) : "Empty table, but exists");
    }
  }
}

inspectSchema();
