CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'OVERDUE', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('RENT', 'DEPOSIT', 'LATE_FEE', 'MAINTENANCE', 'UTILITY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'INACTIVE', 'PENDING', 'TERMINATED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar NOT NULL,
	"lot_id" varchar NOT NULL,
	"type" "payment_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"emergency_contact_name" varchar,
	"emergency_contact_phone" varchar,
	"status" "tenant_status" DEFAULT 'PENDING' NOT NULL,
	"lease_start_date" timestamp,
	"lease_end_date" timestamp,
	"monthly_rent" numeric(10, 2),
	"security_deposit" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "price_for_rent" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "price_for_sale" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "price_rent_to_own" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "price_contract_for_deed" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_payment_idx" ON "payments" USING btree ("tenant_id","due_date");--> statement-breakpoint
CREATE INDEX "lot_payment_idx" ON "payments" USING btree ("lot_id","due_date");--> statement-breakpoint
CREATE INDEX "lot_tenant_idx" ON "tenants" USING btree ("lot_id","status");