-- Migration: 20260809_create_stories_and_rls.sql
-- Description: Create public.stories and public.story_media tables, enable RLS, and set up RLS policies in Supabase.

-- 1. Ensure uuid-ossp extension is present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create public.stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT,
  media_type VARCHAR(50) DEFAULT 'image',
  caption TEXT,
  location TEXT,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_scheduled BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'published'
);

-- Add index on author_id and created_at for fast retrieval
CREATE INDEX IF NOT EXISTS idx_stories_author ON public.stories(author_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON public.stories(created_at);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);

-- 3. Create public.story_media table for multi-media stories
CREATE TABLE IF NOT EXISTS public.story_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(50) DEFAULT 'image',
  display_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_media_story ON public.story_media(story_id);

-- 4. Enable Row Level Security (RLS) on public.stories and public.story_media
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_media ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if any to avoid duplication conflicts
DROP POLICY IF EXISTS "Public stories policy" ON public.stories;
DROP POLICY IF EXISTS "Public stories select policy" ON public.stories;
DROP POLICY IF EXISTS "Public stories insert policy" ON public.stories;
DROP POLICY IF EXISTS "Public stories update policy" ON public.stories;
DROP POLICY IF EXISTS "Public stories delete policy" ON public.stories;

DROP POLICY IF EXISTS "Public story_media policy" ON public.story_media;
DROP POLICY IF EXISTS "Public story_media select policy" ON public.story_media;
DROP POLICY IF EXISTS "Public story_media insert policy" ON public.story_media;

-- 6. Create RLS Policies for public.stories
CREATE POLICY "Public stories select policy" ON public.stories
  FOR SELECT USING (true);

CREATE POLICY "Public stories insert policy" ON public.stories
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public stories update policy" ON public.stories
  FOR UPDATE USING (true);

CREATE POLICY "Public stories delete policy" ON public.stories
  FOR DELETE USING (true);

-- 7. Create RLS Policies for public.story_media
CREATE POLICY "Public story_media select policy" ON public.story_media
  FOR SELECT USING (true);

CREATE POLICY "Public story_media insert policy" ON public.story_media
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public story_media update policy" ON public.story_media
  FOR UPDATE USING (true);

CREATE POLICY "Public story_media delete policy" ON public.story_media
  FOR DELETE USING (true);
