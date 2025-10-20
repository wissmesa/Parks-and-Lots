CREATE TABLE "login_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"email" varchar NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" varchar,
	"location_city" varchar,
	"location_region" varchar,
	"location_country" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "deposit_for_rent" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "deposit_for_sale" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "deposit_rent_to_own" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "deposit_contract_for_deed" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "down_payment_contract_for_deed" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "promotional_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "promotional_price_active" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "estimated_payment" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "available_date" timestamp;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "mobile_home_year" integer;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "mobile_home_size" varchar;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "facebook_post_id" varchar;--> statement-breakpoint
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_logs_created_at_idx" ON "login_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_logs_user_id_idx" ON "login_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_logs_email_idx" ON "login_logs" USING btree ("email");--> statement-breakpoint
ALTER TABLE "public"."invites" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."user_role";--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('MHP_LORD', 'MANAGER', 'ADMIN', 'TENANT');--> statement-breakpoint
ALTER TABLE "public"."invites" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";--> statement-breakpoint
ALTER TABLE "public"."users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::"public"."user_role";