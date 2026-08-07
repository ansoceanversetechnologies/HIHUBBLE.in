import { supabase } from './supabase.js';

async function testRpc() {
  console.log("Testing raw SQL execution via Supabase RPC / SQL...");
  
  const sql = `
    ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
    ALTER TABLE public.likes ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
    
    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL,
      target_type target_type,
      post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
      comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
      story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log("RPC exec_sql notice:", error.message);
    } else {
      console.log("✅ Executed SQL successfully via RPC!");
    }
  } catch (err) {
    console.log("RPC error:", err.message);
  }
}

testRpc();
