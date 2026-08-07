import { supabase } from './supabase.js';

async function testColumns() {
  console.log("Testing columns on public.comments...");

  const { error: cErr } = await supabase.from('comments').insert([{
    id: '00000000-0000-0000-0000-000000000001',
    author_id: '00000000-0000-0000-0000-000000000001',
    post_id: '00000000-0000-0000-0000-000000000001',
    content: 'test',
    parent_comment_id: null
  }]);

  if (cErr) {
    console.log("Comment insert test result:", cErr.message, "(code:", cErr.code, ")");
  } else {
    console.log("✅ parent_comment_id column exists on comments table!");
    // Clean up test row
    await supabase.from('comments').delete().eq('id', '00000000-0000-0000-0000-000000000001');
  }

  console.log("Testing columns on public.likes...");
  const { error: lErr } = await supabase.from('likes').insert([{
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    post_id: '00000000-0000-0000-0000-000000000001',
    comment_id: null,
    target_type: 'post'
  }]);

  if (lErr) {
    console.log("Likes insert test result:", lErr.message, "(code:", lErr.code, ")");
  } else {
    console.log("✅ comment_id and target_type columns exist on likes table!");
    await supabase.from('likes').delete().eq('id', '00000000-0000-0000-0000-000000000001');
  }
}

testColumns();
