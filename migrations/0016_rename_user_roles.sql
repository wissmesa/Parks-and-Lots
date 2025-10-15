-- Rename user roles: ADMIN -> MHP_LORD, COMPANY_MANAGER -> ADMIN

-- First, update existing data in both users and invites tables
-- Set role to text temporarily to allow updates
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE text;
ALTER TABLE "public"."invites" ALTER COLUMN "role" SET DATA TYPE text;

-- Update existing users with old roles to new roles
UPDATE "public"."users" 
SET "role" = 'MHP_LORD' 
WHERE "role" = 'ADMIN';

UPDATE "public"."users" 
SET "role" = 'ADMIN' 
WHERE "role" = 'COMPANY_MANAGER';

-- Update existing invites with old roles to new roles
UPDATE "public"."invites" 
SET "role" = 'MHP_LORD' 
WHERE "role" = 'ADMIN';

UPDATE "public"."invites" 
SET "role" = 'ADMIN' 
WHERE "role" = 'COMPANY_MANAGER';

-- Drop the old enum type
DROP TYPE IF EXISTS "public"."user_role";

-- Create new enum type with updated values
CREATE TYPE "public"."user_role" AS ENUM('MHP_LORD', 'MANAGER', 'ADMIN', 'TENANT');

-- Set the columns back to use the new enum type
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";
ALTER TABLE "public"."invites" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";

