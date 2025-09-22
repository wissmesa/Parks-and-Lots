CREATE TYPE "public"."availability_rule" AS ENUM('OPEN_SLOT', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('COMPANY', 'PARK', 'LOT');--> statement-breakpoint
CREATE TYPE "public"."lot_status" AS ENUM('FOR_RENT', 'FOR_SALE', 'RENT_SALE');--> statement-breakpoint
CREATE TYPE "public"."showing_status" AS ENUM('SCHEDULED', 'CANCELED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'MANAGER');--> statement-breakpoint
CREATE TABLE "availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" varchar NOT NULL,
	"rule_type" "availability_rule" NOT NULL,
	"start_dt" timestamp NOT NULL,
	"end_dt" timestamp NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp NOT NULL,
	"scope" text NOT NULL,
	"token_type" varchar DEFAULT 'Bearer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_calendar_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"role" "user_role" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" varchar NOT NULL,
	"accepted_at" timestamp,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"park_id" varchar NOT NULL,
	"name_or_number" varchar NOT NULL,
	"status" "lot_status",
	"price" numeric(10, 2) NOT NULL,
	"description" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"sq_ft" integer,
	"special_status_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"park_id" varchar NOT NULL,
	CONSTRAINT "manager_assignments_user_id_park_id_unique" UNIQUE("user_id","park_id")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider" varchar NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expiry" timestamp,
	"external_calendar_id" varchar
);
--> statement-breakpoint
CREATE TABLE "parks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"address" varchar NOT NULL,
	"city" varchar NOT NULL,
	"state" varchar NOT NULL,
	"zip" varchar NOT NULL,
	"description" text,
	"amenities" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" varchar NOT NULL,
	"url_or_path" varchar NOT NULL,
	"caption" varchar,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "showings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" varchar NOT NULL,
	"manager_id" varchar NOT NULL,
	"start_dt" timestamp NOT NULL,
	"end_dt" timestamp NOT NULL,
	"client_name" varchar NOT NULL,
	"client_email" varchar NOT NULL,
	"client_phone" varchar NOT NULL,
	"status" "showing_status" DEFAULT 'SCHEDULED' NOT NULL,
	"calendar_event_id" varchar,
	"calendar_html_link" varchar,
	"calendar_sync_error" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "special_statuses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"park_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"color" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"full_name" varchar NOT NULL,
	"role" "user_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"reset_token" varchar,
	"reset_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_park_id_parks_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."parks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_special_status_id_special_statuses_id_fk" FOREIGN KEY ("special_status_id") REFERENCES "public"."special_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_assignments" ADD CONSTRAINT "manager_assignments_park_id_parks_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."parks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parks" ADD CONSTRAINT "parks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_statuses" ADD CONSTRAINT "special_statuses_park_id_parks_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."parks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_lot_time_idx" ON "availability" USING btree ("lot_id","start_dt","end_dt");--> statement-breakpoint
CREATE INDEX "lot_time_idx" ON "showings" USING btree ("lot_id","start_dt","end_dt");