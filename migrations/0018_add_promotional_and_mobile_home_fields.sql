-- Add promotional pricing, estimated payment, available date, and mobile home fields to lots table
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "promotional_price" numeric(10, 2);
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "promotional_price_active" boolean DEFAULT false;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "estimated_payment" numeric(10, 2);
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "available_date" timestamp;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "mobile_home_year" integer;
ALTER TABLE "lots" ADD COLUMN IF NOT EXISTS "mobile_home_size" varchar;

