import { sql } from "drizzle-orm";
import { 
  pgTable, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  decimal, 
  integer,
  pgEnum,
  index,
  unique,
  bytea
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['MHP_LORD', 'MANAGER', 'ADMIN', 'TENANT']);
export const lotStatusEnum = pgEnum('lot_status', ['FOR_RENT', 'FOR_SALE', 'RENT_SALE', 'RENT_TO_OWN', 'CONTRACT_FOR_DEED']);
export const showingStatusEnum = pgEnum('showing_status', ['SCHEDULED', 'CANCELED', 'COMPLETED']);
export const reminderPreferenceEnum = pgEnum('reminder_preference', ['SMS', 'EMAIL', 'BOTH']);
export const entityTypeEnum = pgEnum('entity_type', ['COMPANY', 'PARK', 'LOT']);
export const availabilityRuleEnum = pgEnum('availability_rule', ['OPEN_SLOT', 'BLOCKED']);
export const tenantStatusEnum = pgEnum('tenant_status', ['ACTIVE', 'INACTIVE', 'PENDING', 'TERMINATED']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PAID', 'OVERDUE', 'PARTIAL']);
export const paymentTypeEnum = pgEnum('payment_type', ['RENT', 'DEPOSIT', 'LATE_FEE', 'MAINTENANCE', 'UTILITY', 'OTHER']);

// CRM Enums
export const dealStageEnum = pgEnum('deal_stage', [
  'QUALIFIED_LEAD',
  'SHOWING_SCHEDULED', 
  'SHOWING_COMPLETED',
  'APPLIED_TO_ALL',
  'FINANCING_APPROVED',
  'DEPOSIT_PAID_CONTRACT_SIGNED',
  'CLOSED_WON',
  'CLOSED_LOST'
]);
export const taskStatusEnum = pgEnum('task_status', ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const taskPriorityEnum = pgEnum('task_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const activityTypeEnum = pgEnum('activity_type', [
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
]);
export const crmEntityTypeEnum = pgEnum('crm_entity_type', ['CONTACT', 'DEAL', 'LOT', 'TASK']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  fullName: varchar("full_name").notNull(),
  role: userRoleEnum("role").notNull(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  companyId: varchar("company_id").references(() => companies.id), // For ADMIN role
  isActive: boolean("is_active").default(true).notNull(),
  resetToken: varchar("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invites table
export const invites = pgTable("invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  role: userRoleEnum("role").notNull(),
  companyId: varchar("company_id").references(() => companies.id), // For ADMIN role
  parkId: varchar("park_id").references(() => parks.id), // For MANAGER role
  expiresAt: timestamp("expires_at").notNull(),
  token: varchar("token").notNull().unique(),
  acceptedAt: timestamp("accepted_at"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Companies table
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  address: varchar("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  phone: varchar("phone"),
  email: varchar("email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Parks table
export const parks = pgTable("parks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  name: varchar("name").notNull(),
  address: varchar("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  zip: varchar("zip").notNull(),
  description: text("description"),
  meetingPlace: text("meeting_place"),
  amenities: text("amenities").array(),
  lotRent: decimal("lot_rent", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Manager assignments (many-to-many)
export const managerAssignments = pgTable("manager_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  parkId: varchar("park_id").references(() => parks.id).notNull(),
}, (table) => ({
  uniqueAssignment: unique().on(table.userId, table.parkId),
}));

// Google Calendar integration for managers
export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at").notNull(),
  scope: text("scope").notNull(),
  tokenType: varchar("token_type").default("Bearer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Special status table - park-specific statuses for lots
export const specialStatuses = pgTable("special_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parkId: varchar("park_id").references(() => parks.id).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  color: varchar("color"), // Optional hex color for UI display
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lots table
export const lots = pgTable("lots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parkId: varchar("park_id").references(() => parks.id),
  nameOrNumber: varchar("name_or_number").notNull(),
  status: lotStatusEnum("status").array(),
  price: decimal("price", { precision: 10, scale: 2 }), // Legacy price field - optional, use specific price fields instead
  priceForRent: decimal("price_for_rent", { precision: 10, scale: 2 }),
  priceForSale: decimal("price_for_sale", { precision: 10, scale: 2 }),
  priceRentToOwn: decimal("price_rent_to_own", { precision: 10, scale: 2 }),
  priceContractForDeed: decimal("price_contract_for_deed", { precision: 10, scale: 2 }),
  depositForRent: decimal("deposit_for_rent", { precision: 10, scale: 2 }),
  depositForSale: decimal("deposit_for_sale", { precision: 10, scale: 2 }),
  depositRentToOwn: decimal("deposit_rent_to_own", { precision: 10, scale: 2 }),
  depositContractForDeed: decimal("deposit_contract_for_deed", { precision: 10, scale: 2 }),
  downPaymentContractForDeed: decimal("down_payment_contract_for_deed", { precision: 10, scale: 2 }),
  lotRent: decimal("lot_rent", { precision: 10, scale: 2 }),
  promotionalPrice: decimal("promotional_price", { precision: 10, scale: 2 }),
  promotionalPriceActive: boolean("promotional_price_active").default(false),
  estimatedPayment: decimal("estimated_payment", { precision: 10, scale: 2 }),
  availableDate: timestamp("available_date"),
  mobileHomeYear: integer("mobile_home_year"),
  mobileHomeSize: varchar("mobile_home_size"),
  showingLink: varchar("showing_link"),
  description: text("description"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  sqFt: integer("sq_ft"),
  houseManufacturer: varchar("house_manufacturer"),
  houseModel: varchar("house_model"),
  specialStatusId: varchar("special_status_id").references(() => specialStatuses.id),
  facebookPostId: varchar("facebook_post_id"),
  isActive: boolean("is_active").default(true).notNull(),
});

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  urlOrPath: varchar("url_or_path").notNull(),
  imageData: text("image_data"), // Store image as base64 text
  mimeType: varchar("mime_type"), // Store MIME type
  caption: varchar("caption"),
  sortOrder: integer("sort_order").default(0),
});

// Showings table
export const showings = pgTable("showings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lotId: varchar("lot_id").references(() => lots.id).notNull(),
  managerId: varchar("manager_id").references(() => users.id).notNull(),
  startDt: timestamp("start_dt").notNull(),
  endDt: timestamp("end_dt").notNull(),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone").notNull(),
  reminderPreference: reminderPreferenceEnum("reminder_preference").default('SMS').notNull(),
  status: showingStatusEnum("status").default('SCHEDULED').notNull(),
  calendarEventId: varchar("calendar_event_id"),
  calendarHtmlLink: varchar("calendar_html_link"),
  calendarSyncError: boolean("calendar_sync_error").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  lotTimeIdx: index("lot_time_idx").on(table.lotId, table.startDt, table.endDt),
}));

// Availability table
export const availability = pgTable("availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lotId: varchar("lot_id").references(() => lots.id).notNull(),
  ruleType: availabilityRuleEnum("rule_type").notNull(),
  startDt: timestamp("start_dt").notNull(),
  endDt: timestamp("end_dt").notNull(),
  note: text("note"),
}, (table) => ({
  lotTimeIdx: index("availability_lot_time_idx").on(table.lotId, table.startDt, table.endDt),
}));

// OAuth accounts table
export const oauthAccounts = pgTable("oauth_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  provider: varchar("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  externalCalendarId: varchar("external_calendar_id"),
  spreadsheetId: varchar("spreadsheet_id"), // For Google Sheets integration
  scope: text("scope"), // Store OAuth scopes
});

// Tenants table
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lotId: varchar("lot_id").references(() => lots.id).notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull().unique(),
  phone: varchar("phone").notNull(),
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  status: tenantStatusEnum("status").default('PENDING').notNull(),
  leaseStartDate: timestamp("lease_start_date"),
  leaseEndDate: timestamp("lease_end_date"),
  monthlyRent: decimal("monthly_rent", { precision: 10, scale: 2 }),
  securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  lotTenantIdx: index("lot_tenant_idx").on(table.lotId, table.status),
}));

// Payments table
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id).notNull(),
  lotId: varchar("lot_id").references(() => lots.id).notNull(),
  type: paymentTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: paymentStatusEnum("status").default('PENDING').notNull(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantPaymentIdx: index("tenant_payment_idx").on(table.tenantId, table.dueDate),
  lotPaymentIdx: index("lot_payment_idx").on(table.lotId, table.dueDate),
}));

// Login logs table - tracks all login attempts
export const loginLogs = pgTable("login_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'set null' }),
  email: varchar("email").notNull(),
  success: boolean("success").notNull(),
  ipAddress: varchar("ip_address"),
  locationCity: varchar("location_city"),
  locationRegion: varchar("location_region"),
  locationCountry: varchar("location_country"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("login_logs_created_at_idx").on(table.createdAt),
  userIdIdx: index("login_logs_user_id_idx").on(table.userId),
  emailIdx: index("login_logs_email_idx").on(table.email),
}));

// CRM Contacts table
export const crmContacts = pgTable("crm_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  source: varchar("source"), // e.g., "website", "referral", "walk-in"
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  tags: text("tags").array(), // Array of tags for categorization
  notes: text("notes"), // Quick notes field
  tenantId: varchar("tenant_id").references(() => tenants.id), // Link to existing tenant if applicable
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("crm_contacts_company_idx").on(table.companyId),
  emailIdx: index("crm_contacts_email_idx").on(table.email),
}));

// CRM Deals table
export const crmDeals = pgTable("crm_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }),
  stage: dealStageEnum("stage").notNull().default('QUALIFIED_LEAD'),
  probability: integer("probability").default(0), // 0-100 percentage
  expectedCloseDate: timestamp("expected_close_date"),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  lotId: varchar("lot_id").references(() => lots.id), // Link to specific lot/unit
  assignedTo: varchar("assigned_to").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("crm_deals_company_idx").on(table.companyId),
  stageIdx: index("crm_deals_stage_idx").on(table.stage),
  assignedIdx: index("crm_deals_assigned_idx").on(table.assignedTo),
  contactIdx: index("crm_deals_contact_idx").on(table.contactId),
}));

// CRM Tasks table
export const crmTasks = pgTable("crm_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: taskStatusEnum("status").notNull().default('TODO'),
  priority: taskPriorityEnum("priority").notNull().default('MEDIUM'),
  tags: text("tags").array(),
  assignedTo: varchar("assigned_to").references(() => users.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  // Polymorphic association
  entityType: crmEntityTypeEnum("entity_type"),
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("crm_tasks_company_idx").on(table.companyId),
  assignedIdx: index("crm_tasks_assigned_idx").on(table.assignedTo),
  statusIdx: index("crm_tasks_status_idx").on(table.status),
  dueDateIdx: index("crm_tasks_due_date_idx").on(table.dueDate),
  entityIdx: index("crm_tasks_entity_idx").on(table.entityType, table.entityId),
}));

// CRM Notes table
export const crmNotes = pgTable("crm_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  entityType: crmEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("crm_notes_entity_idx").on(table.entityType, table.entityId),
  companyIdx: index("crm_notes_company_idx").on(table.companyId),
}));

// CRM Activities table - auto-generated activity log
export const crmActivities = pgTable("crm_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  entityType: crmEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("crm_activities_entity_idx").on(table.entityType, table.entityId),
  companyIdx: index("crm_activities_company_idx").on(table.companyId),
  createdAtIdx: index("crm_activities_created_at_idx").on(table.createdAt),
}));

// CRM Messages table - real-time DM feature
export const crmMessages = pgTable("crm_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  receiverId: varchar("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  read: boolean("read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  senderIdx: index("crm_messages_sender_idx").on(table.senderId),
  receiverIdx: index("crm_messages_receiver_idx").on(table.receiverId),
  conversationIdx: index("crm_messages_conversation_idx").on(table.senderId, table.receiverId),
  companyIdx: index("crm_messages_company_idx").on(table.companyId),
  readIdx: index("crm_messages_read_idx").on(table.read),
}));

// CRM Associations table - many-to-many relationships between entities
export const crmAssociations = pgTable("crm_associations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: crmEntityTypeEnum("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  targetType: crmEntityTypeEnum("target_type").notNull(),
  targetId: varchar("target_id").notNull(),
  relationshipType: varchar("relationship_type"), // e.g., "primary_contact", "related_deal"
  companyId: varchar("company_id").references(() => companies.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("crm_associations_source_idx").on(table.sourceType, table.sourceId),
  targetIdx: index("crm_associations_target_idx").on(table.targetType, table.targetId),
  companyIdx: index("crm_associations_company_idx").on(table.companyId),
  uniqueAssoc: unique().on(table.sourceType, table.sourceId, table.targetType, table.targetId),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  managerAssignments: many(managerAssignments),
  showings: many(showings),
  oauthAccounts: many(oauthAccounts),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  parks: many(parks),
  companyManagers: many(users),
}));

export const parksRelations = relations(parks, ({ one, many }) => ({
  company: one(companies, {
    fields: [parks.companyId],
    references: [companies.id],
  }),
  lots: many(lots),
  specialStatuses: many(specialStatuses),
  managerAssignments: many(managerAssignments),
  photos: many(photos),
}));

export const specialStatusesRelations = relations(specialStatuses, ({ one, many }) => ({
  park: one(parks, {
    fields: [specialStatuses.parkId],
    references: [parks.id],
  }),
  lots: many(lots),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  park: one(parks, {
    fields: [lots.parkId],
    references: [parks.id],
  }),
  specialStatus: one(specialStatuses, {
    fields: [lots.specialStatusId],
    references: [specialStatuses.id],
  }),
  showings: many(showings),
  availability: many(availability),
  photos: many(photos),
  tenants: many(tenants),
  payments: many(payments),
}));

export const showingsRelations = relations(showings, ({ one }) => ({
  lot: one(lots, {
    fields: [showings.lotId],
    references: [lots.id],
  }),
  manager: one(users, {
    fields: [showings.managerId],
    references: [users.id],
  }),
}));

export const managerAssignmentsRelations = relations(managerAssignments, ({ one }) => ({
  user: one(users, {
    fields: [managerAssignments.userId],
    references: [users.id],
  }),
  park: one(parks, {
    fields: [managerAssignments.parkId],
    references: [parks.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  park: one(parks, {
    fields: [photos.entityId],
    references: [parks.id],
  }),
  lot: one(lots, {
    fields: [photos.entityId],
    references: [lots.id],
  }),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  lot: one(lots, {
    fields: [availability.lotId],
    references: [lots.id],
  }),
}));

export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  lot: one(lots, {
    fields: [tenants.lotId],
    references: [lots.id],
  }),
  user: one(users, {
    fields: [tenants.id],
    references: [users.tenantId],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  Tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  lot: one(lots, {
    fields: [payments.lotId],
    references: [lots.id],
  }),
}));

// CRM Relations
export const crmContactsRelations = relations(crmContacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [crmContacts.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [crmContacts.createdBy],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [crmContacts.tenantId],
    references: [tenants.id],
  }),
  deals: many(crmDeals),
  tasks: many(crmTasks),
  notes: many(crmNotes),
  activities: many(crmActivities),
}));

export const crmDealsRelations = relations(crmDeals, ({ one, many }) => ({
  contact: one(crmContacts, {
    fields: [crmDeals.contactId],
    references: [crmContacts.id],
  }),
  lot: one(lots, {
    fields: [crmDeals.lotId],
    references: [lots.id],
  }),
  assignedToUser: one(users, {
    fields: [crmDeals.assignedTo],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [crmDeals.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [crmDeals.createdBy],
    references: [users.id],
  }),
  tasks: many(crmTasks),
  notes: many(crmNotes),
  activities: many(crmActivities),
}));

export const crmTasksRelations = relations(crmTasks, ({ one }) => ({
  assignedToUser: one(users, {
    fields: [crmTasks.assignedTo],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [crmTasks.createdBy],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [crmTasks.companyId],
    references: [companies.id],
  }),
}));

export const crmNotesRelations = relations(crmNotes, ({ one }) => ({
  createdByUser: one(users, {
    fields: [crmNotes.createdBy],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [crmNotes.companyId],
    references: [companies.id],
  }),
}));

export const crmActivitiesRelations = relations(crmActivities, ({ one }) => ({
  user: one(users, {
    fields: [crmActivities.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [crmActivities.companyId],
    references: [companies.id],
  }),
}));

export const crmMessagesRelations = relations(crmMessages, ({ one }) => ({
  sender: one(users, {
    fields: [crmMessages.senderId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [crmMessages.receiverId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [crmMessages.companyId],
    references: [companies.id],
  }),
}));

export const crmAssociationsRelations = relations(crmAssociations, ({ one }) => ({
  company: one(companies, {
    fields: [crmAssociations.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [crmAssociations.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Please enter a valid email address"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies, {
  email: z.string().email("Please enter a valid email address").nullable().optional(),
  phone: z.string().regex(
    /^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
    "Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)"
  ).nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertParkSchema = createInsertSchema(parks, {
  amenities: z
    .array(
      z.union([
        z.string(),
        z.object({ name: z.string(), icon: z.string().optional() })
      ])
    )
    .optional()
    .transform((amenities) => {
      if (!amenities) return amenities;
      return amenities.map((amenity) => {
        if (typeof amenity === 'object' && amenity !== null) {
          return JSON.stringify(amenity);
        }
        return amenity;
      });
    })
}).omit({
  id: true,
  createdAt: true,
});

export const insertLotSchema = createInsertSchema(lots, {
  availableDate: z.union([
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.date(),
    z.null()
  ]).optional().nullable(),
}).omit({
  id: true,
});

export const insertShowingSchema = createInsertSchema(showings).omit({
  id: true,
  createdAt: true,
  calendarEventId: true,
  calendarHtmlLink: true,
  calendarSyncError: true,
});

export const insertAvailabilitySchema = createInsertSchema(availability).omit({
  id: true,
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
});

export const insertInviteSchema = createInsertSchema(invites, {
  email: z.string().email("Please enter a valid email address"),
  companyId: z.string().optional(),
  parkId: z.string().optional(),
}).omit({
  id: true,
  token: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
});

export const insertGoogleCalendarTokenSchema = createInsertSchema(googleCalendarTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSpecialStatusSchema = createInsertSchema(specialStatuses).omit({
  id: true,
  createdAt: true,
});

export const insertTenantSchema = createInsertSchema(tenants, {
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(
    /^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
    "Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)"
  ),
  leaseStartDate: z.union([
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.date(),
    z.null()
  ]).optional().nullable(),
  leaseEndDate: z.union([
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.date(),
    z.null()
  ]).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoginLogSchema = createInsertSchema(loginLogs).omit({
  id: true,
  createdAt: true,
});

export const bookingSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Please enter a valid email address").optional().or(z.literal('')),
  clientPhone: z.string().regex(
    /^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
    "Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)"
  ),
  reminderPreference: z.enum(["SMS", "EMAIL", "BOTH"]),
  startDt: z.string().datetime(),
  endDt: z.string().datetime(),
});

// CRM Zod schemas
export const insertCrmContactSchema = createInsertSchema(crmContacts, {
  email: z.string().email("Please enter a valid email address").optional().nullable(),
  phone: z.string().regex(
    /^(\+1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
    "Please enter a valid US phone number (e.g., (555) 123-4567 or 555-123-4567)"
  ).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmDealSchema = createInsertSchema(crmDeals, {
  expectedCloseDate: z.union([
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.date(),
    z.null()
  ]).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmTaskSchema = createInsertSchema(crmTasks, {
  dueDate: z.union([
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.date(),
    z.null()
  ]).optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmNoteSchema = createInsertSchema(crmNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
  id: true,
  createdAt: true,
});

export const insertCrmMessageSchema = createInsertSchema(crmMessages).omit({
  id: true,
  createdAt: true,
  read: true,
  readAt: true,
});

export const insertCrmAssociationSchema = createInsertSchema(crmAssociations).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Park = typeof parks.$inferSelect;
export type InsertPark = z.infer<typeof insertParkSchema>;
export type Lot = typeof lots.$inferSelect;
export type InsertLot = z.infer<typeof insertLotSchema>;
export type Showing = typeof showings.$inferSelect;
export type InsertShowing = z.infer<typeof insertShowingSchema>;
export type Availability = typeof availability.$inferSelect;
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type GoogleCalendarToken = typeof googleCalendarTokens.$inferSelect;
export type InsertGoogleCalendarToken = z.infer<typeof insertGoogleCalendarTokenSchema>;
export type SpecialStatus = typeof specialStatuses.$inferSelect;
export type InsertSpecialStatus = z.infer<typeof insertSpecialStatusSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type LoginLog = typeof loginLogs.$inferSelect;
export type InsertLoginLog = z.infer<typeof insertLoginLogSchema>;
export type BookingRequest = z.infer<typeof bookingSchema>;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;

// CRM Types
export type CrmContact = typeof crmContacts.$inferSelect;
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;
export type CrmNote = typeof crmNotes.$inferSelect;
export type InsertCrmNote = z.infer<typeof insertCrmNoteSchema>;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;
export type CrmMessage = typeof crmMessages.$inferSelect;
export type InsertCrmMessage = z.infer<typeof insertCrmMessageSchema>;
export type CrmAssociation = typeof crmAssociations.$inferSelect;
export type InsertCrmAssociation = z.infer<typeof insertCrmAssociationSchema>;
