ALTER TABLE "lots" ADD COLUMN "house_manufacturer" varchar;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "house_model" varchar;--> statement-breakpoint
ALTER TABLE "public"."lots" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."lot_status";--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('FOR_RENT', 'FOR_SALE', 'RENT_TO_OWN', 'CONTRACT_FOR_DEED');--> statement-breakpoint
ALTER TABLE "public"."lots" ALTER COLUMN "status" SET DATA TYPE "public"."lot_status" USING "status"::"public"."lot_status";