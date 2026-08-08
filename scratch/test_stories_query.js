import { supabase } from '../supabase.js';

async function testQuery() {
  console.log("Testing stories select query with profiles relationship...");
  
  // Try querying stories with profiles relationship
  const { data, error } = await supabase.from('stories')
    .select('*, author:profiles(id, full_name, username, profile_image_url)')
    .limit(1);

  if (error) {
    console.error("❌ Query failed:", error.message);
  } else {
    console.log("✅ Query succeeded! Data:", data);
  }
}

testQuery();
