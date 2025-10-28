-- Add last_mention_cleared_at column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_mention_cleared_at" timestamp;

