-- Create login_logs table for tracking all login attempts
CREATE TABLE IF NOT EXISTS "login_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "email" varchar NOT NULL,
  "success" boolean NOT NULL,
  "ip_address" varchar,
  "location_city" varchar,
  "location_region" varchar,
  "location_country" varchar,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "login_logs_created_at_idx" ON "login_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "login_logs_user_id_idx" ON "login_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "login_logs_email_idx" ON "login_logs" ("email");

