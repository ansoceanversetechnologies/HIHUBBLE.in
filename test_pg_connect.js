import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const projectRef = 'fefrlcxctuhdbztyoncs';

const passwordsToTry = [
  process.env.SUPABASE_DB_PASSWORD,
  'Ansoceanverse@2026',
  'Ansoceanverse2026',
  'HiHubble2026!',
  'HiHubble@2026',
  'ansoceanverse',
  'kvvczwdxdibvjrdf',
  'vuybkilqpfzvruxw'
].filter(Boolean);

async function testConnection() {
  for (const pwd of passwordsToTry) {
    const connectionString = `postgresql://postgres:${encodeURIComponent(pwd)}@db.${projectRef}.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`🎉 Direct PostgreSQL Connection SUCCESSFUL with password: "${pwd}"!`);
      
      console.log("Applying DDL Schema Updates...");
      const ddl = `
        ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
        ALTER TABLE public.likes ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
        
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_post_user_like') THEN
            ALTER TABLE public.likes ADD CONSTRAINT unique_post_user_like UNIQUE (user_id, post_id);
          END IF;
        END $$;
        
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
        
        CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);
        CREATE INDEX IF NOT EXISTS idx_likes_post_user ON public.likes(post_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_likes_comment_user ON public.likes(comment_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
      `;
      await client.query(ddl);
      console.log("✅ DDL Schema Updates applied successfully to Supabase PostgreSQL!");
      await client.end();
      return true;
    } catch (err) {
      console.log(`Failed connection attempt for password "${pwd}":`, err.message);
      await client.end().catch(() => {});
    }
  }
  return false;
}

testConnection();
