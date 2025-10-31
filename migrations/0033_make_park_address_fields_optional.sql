-- Make address fields optional in parks table
-- Migration: 0033_make_park_address_fields_optional
-- Only name and companyId should be required for parks

ALTER TABLE "parks" ALTER COLUMN "address" DROP NOT NULL;
ALTER TABLE "parks" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "parks" ALTER COLUMN "state" DROP NOT NULL;
ALTER TABLE "parks" ALTER COLUMN "zip" DROP NOT NULL;

