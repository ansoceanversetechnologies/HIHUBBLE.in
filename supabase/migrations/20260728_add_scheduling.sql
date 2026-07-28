-- Add scheduling fields to stories table
ALTER TABLE stories
ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'published';
