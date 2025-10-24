-- Add Facebook advertising fields to lots table

-- Create enum for Facebook ad status
DO $$ BEGIN
  CREATE TYPE "facebook_ad_status" AS ENUM('ADS_ON', 'ADS_OFF');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add Facebook fields to lots table
ALTER TABLE "lots" 
  ADD COLUMN IF NOT EXISTS "facebook_ad_status" "facebook_ad_status",
  ADD COLUMN IF NOT EXISTS "facebook_published_date" timestamp,
  ADD COLUMN IF NOT EXISTS "facebook_published_until" timestamp;

