import pg from 'pg';
import dotenv from 'dotenv';
import { supabase } from './supabase.js';

dotenv.config();

const { Client } = pg;

const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.argv[2];
const projectRef = 'fefrlcxctuhdbztyoncs';

async function applySqlDirectly() {
  if (!dbPassword) {
    console.log("ℹ️ No SUPABASE_DB_PASSWORD provided in .env or arguments. Checking schema via Supabase JS client...");
    return false;
  }

  const connectionString = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;
  console.log(`Connecting directly to PostgreSQL database (db.${projectRef}.supabase.co)...`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected directly to PostgreSQL via pg.");

    const ddlQueries = [
      `ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_post_user_like') THEN
          ALTER TABLE public.likes ADD CONSTRAINT unique_post_user_like UNIQUE (user_id, post_id);
        END IF;
      END $$;`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_comment_user_like') THEN
          ALTER TABLE public.likes ADD CONSTRAINT unique_comment_user_like UNIQUE (user_id, comment_id);
        END IF;
      END $$;`,
      `CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);`,
      `CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_likes_post_user ON public.likes(post_id, user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_likes_comment_user ON public.likes(comment_id, user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'likes') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
      END $$;`
    ];

    for (const query of ddlQueries) {
      await client.query(query);
    }
    console.log("✅ Database DDL repairs executed successfully!");
    return true;
  } catch (err) {
    console.error("⚠️ Direct PG migration notice:", err.message);
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function verifyWithSupabaseClient() {
  console.log("Verifying schema access using Supabase Client...");

  // Test selecting comments
  const { data: comments, error: cErr } = await supabase.from('comments').select('id, parent_comment_id, post_id, content').limit(1);
  if (cErr) {
    console.error("❌ Comments table check error:", cErr.message);
  } else {
    console.log("✅ Comments table access verified (parent_comment_id column functional).");
  }

  // Test selecting likes
  const { data: likes, error: lErr } = await supabase.from('likes').select('id, post_id, comment_id, user_id').limit(1);
  if (lErr) {
    console.error("❌ Likes table check error:", lErr.message);
  } else {
    console.log("✅ Likes table access verified.");
  }

  // Test selecting notifications
  const { data: notifs, error: nErr } = await supabase.from('notifications').select('id, recipient_id, sender_id, type').limit(1);
  if (nErr) {
    console.error("❌ Notifications table check error:", nErr.message);
  } else {
    console.log("✅ Notifications table access verified.");
  }
}

async function main() {
  await applySqlDirectly();
  await verifyWithSupabaseClient();
}

main();
