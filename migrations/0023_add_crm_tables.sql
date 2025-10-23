-- Create CRM Enums
CREATE TYPE "deal_stage" AS ENUM (
  'QUALIFIED_LEAD',
  'SHOWING_SCHEDULED', 
  'SHOWING_COMPLETED',
  'APPLIED_TO_ALL',
  'FINANCING_APPROVED',
  'DEPOSIT_PAID_CONTRACT_SIGNED',
  'CLOSED_WON',
  'CLOSED_LOST'
);

CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "activity_type" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'STAGE_CHANGED',
  'NOTE_ADDED',
  'TASK_ADDED',
  'EMAIL_SENT',
  'CALL_MADE',
  'MEETING_SCHEDULED',
  'ASSOCIATION_ADDED',
  'ASSOCIATION_REMOVED'
);
CREATE TYPE "crm_entity_type" AS ENUM ('CONTACT', 'DEAL', 'LOT', 'TASK');

-- Create CRM Contacts Table
CREATE TABLE IF NOT EXISTS "crm_contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" varchar NOT NULL,
  "last_name" varchar NOT NULL,
  "email" varchar,
  "phone" varchar,
  "source" varchar,
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "tags" text[],
  "notes" text,
  "tenant_id" varchar REFERENCES "tenants"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_contacts_company_idx" ON "crm_contacts" ("company_id");
CREATE INDEX "crm_contacts_email_idx" ON "crm_contacts" ("email");

-- Create CRM Deals Table
CREATE TABLE IF NOT EXISTS "crm_deals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" varchar NOT NULL,
  "value" decimal(10, 2),
  "stage" "deal_stage" NOT NULL DEFAULT 'QUALIFIED_LEAD',
  "probability" integer DEFAULT 0,
  "expected_close_date" timestamp,
  "contact_id" varchar REFERENCES "crm_contacts"("id"),
  "lot_id" varchar REFERENCES "lots"("id"),
  "assigned_to" varchar NOT NULL REFERENCES "users"("id"),
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_deals_company_idx" ON "crm_deals" ("company_id");
CREATE INDEX "crm_deals_stage_idx" ON "crm_deals" ("stage");
CREATE INDEX "crm_deals_assigned_idx" ON "crm_deals" ("assigned_to");
CREATE INDEX "crm_deals_contact_idx" ON "crm_deals" ("contact_id");

-- Create CRM Tasks Table
CREATE TABLE IF NOT EXISTS "crm_tasks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" varchar NOT NULL,
  "description" text,
  "due_date" timestamp,
  "status" "task_status" NOT NULL DEFAULT 'TODO',
  "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
  "tags" text[],
  "assigned_to" varchar NOT NULL REFERENCES "users"("id"),
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "entity_type" "crm_entity_type",
  "entity_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_tasks_company_idx" ON "crm_tasks" ("company_id");
CREATE INDEX "crm_tasks_assigned_idx" ON "crm_tasks" ("assigned_to");
CREATE INDEX "crm_tasks_status_idx" ON "crm_tasks" ("status");
CREATE INDEX "crm_tasks_due_date_idx" ON "crm_tasks" ("due_date");
CREATE INDEX "crm_tasks_entity_idx" ON "crm_tasks" ("entity_type", "entity_id");

-- Create CRM Notes Table
CREATE TABLE IF NOT EXISTS "crm_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "content" text NOT NULL,
  "entity_type" "crm_entity_type" NOT NULL,
  "entity_id" varchar NOT NULL,
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_notes_entity_idx" ON "crm_notes" ("entity_type", "entity_id");
CREATE INDEX "crm_notes_company_idx" ON "crm_notes" ("company_id");

-- Create CRM Activities Table
CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" "activity_type" NOT NULL,
  "description" text NOT NULL,
  "entity_type" "crm_entity_type" NOT NULL,
  "entity_id" varchar NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "metadata" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_activities_entity_idx" ON "crm_activities" ("entity_type", "entity_id");
CREATE INDEX "crm_activities_company_idx" ON "crm_activities" ("company_id");
CREATE INDEX "crm_activities_created_at_idx" ON "crm_activities" ("created_at");

-- Create CRM Messages Table
CREATE TABLE IF NOT EXISTS "crm_messages" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "sender_id" varchar NOT NULL REFERENCES "users"("id"),
  "receiver_id" varchar NOT NULL REFERENCES "users"("id"),
  "content" text NOT NULL,
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "crm_messages_sender_idx" ON "crm_messages" ("sender_id");
CREATE INDEX "crm_messages_receiver_idx" ON "crm_messages" ("receiver_id");
CREATE INDEX "crm_messages_conversation_idx" ON "crm_messages" ("sender_id", "receiver_id");
CREATE INDEX "crm_messages_company_idx" ON "crm_messages" ("company_id");
CREATE INDEX "crm_messages_read_idx" ON "crm_messages" ("read");

-- Create CRM Associations Table
CREATE TABLE IF NOT EXISTS "crm_associations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_type" "crm_entity_type" NOT NULL,
  "source_id" varchar NOT NULL,
  "target_type" "crm_entity_type" NOT NULL,
  "target_id" varchar NOT NULL,
  "relationship_type" varchar,
  "company_id" varchar NOT NULL REFERENCES "companies"("id"),
  "created_by" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("source_type", "source_id", "target_type", "target_id")
);

CREATE INDEX "crm_associations_source_idx" ON "crm_associations" ("source_type", "source_id");
CREATE INDEX "crm_associations_target_idx" ON "crm_associations" ("target_type", "target_id");
CREATE INDEX "crm_associations_company_idx" ON "crm_associations" ("company_id");

