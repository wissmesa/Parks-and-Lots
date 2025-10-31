-- Add parkId field to crm_contacts table
ALTER TABLE "crm_contacts" ADD COLUMN "park_id" varchar;

-- Add foreign key constraint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_park_id_parks_id_fk" FOREIGN KEY ("park_id") REFERENCES "parks"("id") ON DELETE no action ON UPDATE no action;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "crm_contacts_park_idx" ON "crm_contacts" ("park_id");



