ALTER TYPE "public"."user_role" ADD VALUE 'COMPANY_MANAGER' BEFORE 'TENANT';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address" varchar;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" varchar;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" varchar;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "zip_code" varchar;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" varchar;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;