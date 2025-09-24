ALTER TYPE "public"."user_role" ADD VALUE 'OWNER_TENANT';--> statement-breakpoint
CREATE TABLE "owner_tenant_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"lot_id" varchar NOT NULL,
	"relationship_type" varchar NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "owner_tenant_assignments_user_id_lot_id_unique" UNIQUE("user_id","lot_id")
);
--> statement-breakpoint
ALTER TABLE "owner_tenant_assignments" ADD CONSTRAINT "owner_tenant_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_tenant_assignments" ADD CONSTRAINT "owner_tenant_assignments_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;