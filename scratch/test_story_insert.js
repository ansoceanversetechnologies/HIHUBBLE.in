import { supabase } from '../supabase.js';

async function testInsert() {
  const userId = '00000000-0000-0000-0000-000000000001'; // Mock user ID (make sure it exists or just test structure)
  
  console.log("Testing insert with 'author'...");
  const res1 = await supabase.from('stories').insert([{
    author: userId,
    mediaUrl: 'https://example.com/test.jpg',
    mediaType: 'image'
  }]).select('id');
  console.log("Result with 'author':", res1.error ? `❌ Fail: ${res1.error.message}` : "✅ Success!");

  console.log("Testing insert with 'author_id'...");
  const res2 = await supabase.from('stories').insert([{
    author_id: userId,
    mediaUrl: 'https://example.com/test.jpg',
    mediaType: 'image'
  }]).select('id');
  console.log("Result with 'author_id':", res2.error ? `❌ Fail: ${res2.error.message}` : "✅ Success!");
}

testInsert();
