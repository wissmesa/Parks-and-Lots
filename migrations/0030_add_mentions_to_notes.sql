-- Add mentioned_users column to crm_notes table
ALTER TABLE "crm_notes" ADD COLUMN "mentioned_users" text[];

