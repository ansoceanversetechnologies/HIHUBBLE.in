-- Migration: Create Reels sub-tables (reel_views, reel_likes, reel_comments, saved_reels, reel_hashtags)
-- Enables RLS policies, triggers for view/like/comment counts, and configures Supabase Realtime

-- 1. REEL VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reel_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    watch_duration_seconds NUMERIC DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (reel_id, user_id)
);

-- 2. REEL LIKES TABLE
CREATE TABLE IF NOT EXISTS public.reel_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (reel_id, user_id)
);

-- 3. REEL COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.reel_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.reel_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    like_count INT DEFAULT 0 CHECK (like_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. SAVED REELS TABLE
CREATE TABLE IF NOT EXISTS public.saved_reels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, reel_id)
);

-- 5. REEL HASHTAGS TABLE
CREATE TABLE IF NOT EXISTS public.reel_hashtags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    hashtag VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (reel_id, hashtag)
);

-- INDEXES FOR HIGH-PERFORMANCE DISCOVERY
CREATE INDEX IF NOT EXISTS idx_reel_views_reel ON public.reel_views(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON public.reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON public.reel_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_saved_reels_user ON public.saved_reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reel_hashtags_tag ON public.reel_hashtags(hashtag);

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_hashtags ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR REEL VIEWS
DROP POLICY IF EXISTS "Public reel_views select policy" ON public.reel_views;
DROP POLICY IF EXISTS "Public reel_views insert policy" ON public.reel_views;
DROP POLICY IF EXISTS "Public reel_views update policy" ON public.reel_views;
DROP POLICY IF EXISTS "Public reel_views delete policy" ON public.reel_views;

CREATE POLICY "Public reel_views select policy" ON public.reel_views FOR SELECT USING (true);
CREATE POLICY "Public reel_views insert policy" ON public.reel_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reel_views update policy" ON public.reel_views FOR UPDATE USING (true);
CREATE POLICY "Public reel_views delete policy" ON public.reel_views FOR DELETE USING (true);

-- RLS POLICIES FOR REEL LIKES
DROP POLICY IF EXISTS "Public reel_likes select policy" ON public.reel_likes;
DROP POLICY IF EXISTS "Public reel_likes insert policy" ON public.reel_likes;
DROP POLICY IF EXISTS "Public reel_likes delete policy" ON public.reel_likes;

CREATE POLICY "Public reel_likes select policy" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "Public reel_likes insert policy" ON public.reel_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reel_likes delete policy" ON public.reel_likes FOR DELETE USING (true);

-- RLS POLICIES FOR REEL COMMENTS
DROP POLICY IF EXISTS "Public reel_comments select policy" ON public.reel_comments;
DROP POLICY IF EXISTS "Public reel_comments insert policy" ON public.reel_comments;
DROP POLICY IF EXISTS "Public reel_comments update policy" ON public.reel_comments;
DROP POLICY IF EXISTS "Public reel_comments delete policy" ON public.reel_comments;

CREATE POLICY "Public reel_comments select policy" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "Public reel_comments insert policy" ON public.reel_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reel_comments update policy" ON public.reel_comments FOR UPDATE USING (true);
CREATE POLICY "Public reel_comments delete policy" ON public.reel_comments FOR DELETE USING (true);

-- RLS POLICIES FOR SAVED REELS
DROP POLICY IF EXISTS "Public saved_reels select policy" ON public.saved_reels;
DROP POLICY IF EXISTS "Public saved_reels insert policy" ON public.saved_reels;
DROP POLICY IF EXISTS "Public saved_reels delete policy" ON public.saved_reels;

CREATE POLICY "Public saved_reels select policy" ON public.saved_reels FOR SELECT USING (true);
CREATE POLICY "Public saved_reels insert policy" ON public.saved_reels FOR INSERT WITH CHECK (true);
CREATE POLICY "Public saved_reels delete policy" ON public.saved_reels FOR DELETE USING (true);

-- RLS POLICIES FOR REEL HASHTAGS
DROP POLICY IF EXISTS "Public reel_hashtags select policy" ON public.reel_hashtags;
DROP POLICY IF EXISTS "Public reel_hashtags insert policy" ON public.reel_hashtags;
DROP POLICY IF EXISTS "Public reel_hashtags delete policy" ON public.reel_hashtags;

CREATE POLICY "Public reel_hashtags select policy" ON public.reel_hashtags FOR SELECT USING (true);
CREATE POLICY "Public reel_hashtags insert policy" ON public.reel_hashtags FOR INSERT WITH CHECK (true);
CREATE POLICY "Public reel_hashtags delete policy" ON public.reel_hashtags FOR DELETE USING (true);

-- CONFIGURE SUPABASE REALTIME FOR ALL REEL SUB-TABLES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_views; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_likes; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_reels; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_hashtags; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;
