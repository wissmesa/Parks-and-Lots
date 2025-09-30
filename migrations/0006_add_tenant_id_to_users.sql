-- Add tenant_id column to users table for linking users to tenants
ALTER TABLE "users" ADD COLUMN "tenant_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
