-- ========================================
-- SCRIPT PARA APLICAR MIGRACIONES FALTANTES EN PRODUCCIÓN
-- Migraciones: 0016 a 0022
-- Fecha: 2025-01-22
-- ========================================

-- ========================================
-- MIGRACIÓN 0016: Rename user roles
-- ========================================
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

-- ========================================
-- MIGRACIÓN 0017: Add login_logs table
-- ========================================
-- Create login_logs table for tracking all login attempts
CREATE TABLE IF NOT EXISTS "login_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "email" varchar NOT NULL,
  "success" boolean NOT NULL,
  "ip_address" varchar,
  "location_city" varchar,
  "location_region" varchar,
  "location_country" varchar,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "login_logs_created_at_idx" ON "login_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "login_logs_user_id_idx" ON "login_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "login_logs_email_idx" ON "login_logs" ("email");

-- ========================================
-- MIGRACIÓN 0018: Add promotional and mobile home fields
-- ========================================
-- Add promotional pricing, estimated payment, available date, and mobile home fields to lots table
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "promotional_price" numeric(10, 2);
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "promotional_price_active" boolean DEFAULT false;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "estimated_payment" numeric(10, 2);
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "available_date" timestamp;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "mobile_home_year" integer;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "mobile_home_size" varchar;

-- ========================================
-- MIGRACIÓN 0019: Add deposit and down payment fields
-- ========================================
-- Add deposit and down payment fields to lots table
ALTER TABLE lots ADD COLUMN IF NOT EXISTS deposit_for_rent NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS deposit_for_sale NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS deposit_rent_to_own NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS deposit_contract_for_deed NUMERIC(10, 2);
ALTER TABLE lots ADD COLUMN IF NOT EXISTS down_payment_contract_for_deed NUMERIC(10, 2);

-- ========================================
-- MIGRACIÓN 0020: Make lot park_id nullable
-- ========================================
-- Make park_id nullable in lots table to allow creating lots without park assignment
ALTER TABLE lots ALTER COLUMN park_id DROP NOT NULL;

-- ========================================
-- MIGRACIÓN 0021: Make lot price nullable
-- ========================================
-- Make price nullable in lots table (legacy field, use specific price fields instead)
ALTER TABLE lots ALTER COLUMN price DROP NOT NULL;

-- ========================================
-- MIGRACIÓN 0022: Add image_data to photos
-- ========================================
-- Add imageData column to photos table to store images as base64 text
ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================
-- Puedes ejecutar estas consultas para verificar que todo se aplicó correctamente:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'photos';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lots';
-- SELECT * FROM information_schema.tables WHERE table_name = 'login_logs';

