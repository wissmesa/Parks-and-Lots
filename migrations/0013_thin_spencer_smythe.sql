CREATE TYPE "public"."reminder_preference" AS ENUM('SMS', 'EMAIL', 'BOTH');--> statement-breakpoint
ALTER TABLE "showings" ALTER COLUMN "client_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "spreadsheet_id" varchar;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "parks" ADD COLUMN "meeting_place" text;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "reminder_preference" "reminder_preference" DEFAULT 'SMS' NOT NULL;