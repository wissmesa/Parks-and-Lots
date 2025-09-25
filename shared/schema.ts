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
  unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MANAGER']);
export const lotStatusEnum = pgEnum('lot_status', ['FOR_RENT', 'FOR_SALE', 'RENT_TO_OWN', 'CONTRACT_FOR_DEED']);
export const showingStatusEnum = pgEnum('showing_status', ['SCHEDULED', 'CANCELED', 'COMPLETED']);
export const entityTypeEnum = pgEnum('entity_type', ['COMPANY', 'PARK', 'LOT']);
export const availabilityRuleEnum = pgEnum('availability_rule', ['OPEN_SLOT', 'BLOCKED']);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  fullName: varchar("full_name").notNull(),
  role: userRoleEnum("role").notNull(),
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
  amenities: text("amenities").array(),
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
  parkId: varchar("park_id").references(() => parks.id).notNull(),
  nameOrNumber: varchar("name_or_number").notNull(),
  status: lotStatusEnum("status").array(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Legacy price field - keep for backward compatibility
  priceForRent: decimal("price_for_rent", { precision: 10, scale: 2 }),
  priceForSale: decimal("price_for_sale", { precision: 10, scale: 2 }),
  priceRentToOwn: decimal("price_rent_to_own", { precision: 10, scale: 2 }),
  priceContractForDeed: decimal("price_contract_for_deed", { precision: 10, scale: 2 }),
  description: text("description"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  sqFt: integer("sq_ft"),
  houseManufacturer: varchar("house_manufacturer"),
  houseModel: varchar("house_model"),
  specialStatusId: varchar("special_status_id").references(() => specialStatuses.id),
  isActive: boolean("is_active").default(true).notNull(),
});

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  urlOrPath: varchar("url_or_path").notNull(),
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
  clientEmail: varchar("client_email").notNull(),
  clientPhone: varchar("client_phone").notNull(),
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
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  managerAssignments: many(managerAssignments),
  showings: many(showings),
  oauthAccounts: many(oauthAccounts),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  parks: many(parks),
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

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertParkSchema = createInsertSchema(parks).omit({
  id: true,
  createdAt: true,
});

export const insertLotSchema = createInsertSchema(lots).omit({
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

export const insertInviteSchema = createInsertSchema(invites).omit({
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

export const bookingSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  clientPhone: z.string().min(1),
  startDt: z.string().datetime(),
  endDt: z.string().datetime(),
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
export type BookingRequest = z.infer<typeof bookingSchema>;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
