-- Add contact and address fields to companies table
ALTER TABLE "companies" ADD COLUMN "address" varchar;
ALTER TABLE "companies" ADD COLUMN "city" varchar;
ALTER TABLE "companies" ADD COLUMN "state" varchar;
ALTER TABLE "companies" ADD COLUMN "zip_code" varchar;
ALTER TABLE "companies" ADD COLUMN "phone" varchar;
ALTER TABLE "companies" ADD COLUMN "email" varchar;
