-- Migration DDL: Create Reels tables, indexes, RLS policies, and enable Realtime in Supabase

-- 1. Create Reels table if not exists
CREATE TABLE IF NOT EXISTS public.reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    caption TEXT CHECK (char_length(caption) <= 2200),
    audio_track_name VARCHAR(255),
    duration_seconds NUMERIC DEFAULT 0,
    view_count INT DEFAULT 0 CHECK (view_count >= 0),
    like_count INT DEFAULT 0 CHECK (like_count >= 0),
    comment_count INT DEFAULT 0 CHECK (comment_count >= 0),
    share_count INT DEFAULT 0 CHECK (share_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_reels_author_id ON public.reels(author_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for public.reels
DROP POLICY IF EXISTS "Public reels select policy" ON public.reels;
DROP POLICY IF EXISTS "Public reels insert policy" ON public.reels;
DROP POLICY IF EXISTS "Public reels update policy" ON public.reels;
DROP POLICY IF EXISTS "Public reels delete policy" ON public.reels;

CREATE POLICY "Public reels select policy" ON public.reels FOR SELECT USING (true);
CREATE POLICY "Public reels insert policy" ON public.reels FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reels update policy" ON public.reels FOR UPDATE USING (true);
CREATE POLICY "Public reels delete policy" ON public.reels FOR DELETE USING (true);

-- 5. Add public.reels to Supabase Realtime publication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.reels;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;
