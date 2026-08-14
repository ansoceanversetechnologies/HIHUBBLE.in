-- Migration: 20260808_add_hubb_post_fields.sql
-- Description: Add scheduling, status, editor state, and collaborators columns to public.posts

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'published',
ADD COLUMN IF NOT EXISTS editor_state JSONB,
ADD COLUMN IF NOT EXISTS collaborators JSONB;
