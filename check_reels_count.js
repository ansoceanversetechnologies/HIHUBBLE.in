import { supabase } from './supabase.js';

async function check() {
  const { data: reels, error } = await supabase.from('reels').select('*');
  console.log("Current DB Reels count:", reels ? reels.length : 0);
  if (error) console.error("Error:", error);
}

check();
