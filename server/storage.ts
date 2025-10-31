import { 
  users, 
  companies, 
  parks, 
  lots, 
  showings, 
  availability, 
  photos, 
  invites,
  managerAssignments,
  oauthAccounts,
  googleCalendarTokens,
  specialStatuses,
  tenants,
  payments,
  loginLogs,
  crmContacts,
  crmDeals,
  crmTasks,
  crmNotes,
  crmActivities,
  crmMessages,
  crmAssociations,
  auditLogs,
  type User, 
  type InsertUser,
  type Company,
  type InsertCompany,
  type Park,
  type InsertPark,
  type Lot,
  type InsertLot,
  type Showing,
  type InsertShowing,
  type Availability,
  type InsertAvailability,
  type Photo,
  type InsertPhoto,
  type Invite,
  type InsertInvite,
  type GoogleCalendarToken,
  type InsertGoogleCalendarToken,
  type SpecialStatus,
  type InsertSpecialStatus,
  type Tenant,
  type InsertTenant,
  type Payment,
  type InsertPayment,
  type LoginLog,
  type InsertLoginLog,
  type OAuthAccount,
  type CrmContact,
  type InsertCrmContact,
  type CrmDeal,
  type InsertCrmDeal,
  type CrmTask,
  type InsertCrmTask,
  type CrmNote,
  type InsertCrmNote,
  type CrmActivity,
  type InsertCrmActivity,
  type CrmMessage,
  type InsertCrmMessage,
  type CrmAssociation,
  type InsertCrmAssociation,
  type AuditLog
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, gte, lte, or, like, ilike, desc, asc, sql, inArray, isNotNull, isNull } from "drizzle-orm";
import { encryptMessage, decryptMessage } from "./encryption";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUsers(filters?: { role?: 'MHP_LORD' | 'MANAGER' | 'ADMIN' | 'TENANT' }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  getUserWithTenant(id: string): Promise<any | undefined>;
  getUserByTenantId(tenantId: string): Promise<User | undefined>;
  linkUserToTenant(userId: string, tenantId: string): Promise<User>;
  
  // Company operations
  getCompanies(includeInactive?: boolean): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Park operations
  getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string; status?: string; minPrice?: number; maxPrice?: number; includeInactive?: boolean }): Promise<{ parks: Park[] }>;
  getPark(id: string): Promise<Park | undefined>;
  createPark(park: InsertPark): Promise<Park>;
  updatePark(id: string, updates: Partial<InsertPark>): Promise<Park>;
  deletePark(id: string): Promise<void>;
  
  // Lot operations
  getLots(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; includeInactive?: boolean }): Promise<Lot[]>;
  getLot(id: string): Promise<Lot | undefined>;
  createLot(lot: InsertLot): Promise<Lot>;
  updateLot(id: string, updates: Partial<InsertLot>): Promise<Lot>;
  deleteLot(id: string): Promise<void>;
  updateLotRentForPark(parkId: string, lotRent: string): Promise<void>;
  
  // Special Status operations
  getSpecialStatuses(parkId: string, includeInactive?: boolean): Promise<SpecialStatus[]>;
  getSpecialStatus(id: string): Promise<SpecialStatus | undefined>;
  getSpecialStatusByName(parkId: string, name: string): Promise<SpecialStatus | undefined>;
  findOrCreateSpecialStatus(parkId: string, name: string): Promise<SpecialStatus>;
  createSpecialStatus(specialStatus: InsertSpecialStatus): Promise<SpecialStatus>;
  updateSpecialStatus(id: string, updates: Partial<InsertSpecialStatus>): Promise<SpecialStatus>;
  deleteSpecialStatus(id: string): Promise<void>;
  
  // Showing operations
  getShowings(filters?: { lotId?: string; managerId?: string; status?: string }): Promise<Showing[]>;
  getShowing(id: string): Promise<Showing | undefined>;
  createShowing(showing: InsertShowing): Promise<Showing>;
  updateShowing(id: string, updates: Partial<InsertShowing>): Promise<Showing>;
  deleteShowing(id: string): Promise<void>;
  checkShowingOverlap(lotId: string, startDt: Date, endDt: Date, excludeId?: string): Promise<boolean>;
  getScheduledShowingsWithCalendarIds(): Promise<Showing[]>;
  
  // Availability operations
  getAvailability(lotId: string): Promise<Availability[]>;
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  deleteAvailability(id: string): Promise<void>;
  
  // Photo operations
  getPhotos(entityType: string, entityId: string): Promise<Photo[]>;
  getPhoto(id: string): Promise<Photo | null>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
  reorderPhotos(entityType: string, entityId: string, photoOrders: Array<{id: string, sortOrder: number}>): Promise<void>;
  
  // Invite operations
  getInvites(): Promise<Invite[]>;
  getInvite(id: string): Promise<Invite | undefined>;
  getInviteByToken(token: string): Promise<Invite | undefined>;
  getInviteByEmail(email: string): Promise<Invite | undefined>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getInvitesByCompany(companyId: string): Promise<Invite[]>;
  createInvite(invite: InsertInvite & { token: string; expiresAt: Date }): Promise<Invite>;
  acceptInvite(token: string): Promise<Invite>;
  deleteInvite(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getAllManagerAssignments(): Promise<any[]>;
  removeManagerAssignments(userId: string): Promise<void>;
  
  // Audit Log operations
  getAuditLogs(entityType: string, entityId: string, limit?: number): Promise<any[]>;
  
  // Missing method declarations
  getLotsWithParkInfo(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; state?: string; q?: string; includeInactive?: boolean }): Promise<any[]>;
  
  // Unfiltered getters for admin toggle operations (don't filter by isActive)
  getCompanyAny(id: string): Promise<Company | undefined>;
  getParkAny(id: string): Promise<Park | undefined>;
  getLotAny(id: string): Promise<Lot | undefined>;
  
  // Manager assignments
  getManagerAssignments(userId?: string, parkId?: string): Promise<any[]>;
  assignManagerToPark(userId: string, parkId: string): Promise<void>;
  removeManagerFromPark(userId: string, parkId: string): Promise<void>;
  
  // OAuth operations
  getOAuthAccount(userId: string, provider: string): Promise<OAuthAccount | undefined>;
  createOrUpdateOAuthAccount(userId: string, data: Partial<OAuthAccount>): Promise<OAuthAccount>;
  deleteOAuthAccount(userId: string, provider: string): Promise<void>;
  
  // Google Calendar token operations
  getGoogleCalendarToken(userId: string): Promise<GoogleCalendarToken | undefined>;
  createOrUpdateGoogleCalendarToken(userId: string, token: InsertGoogleCalendarToken): Promise<GoogleCalendarToken>;
  deleteGoogleCalendarToken(userId: string): Promise<void>;
  
  // Tenant operations
  getTenants(filters?: { lotId?: string; status?: string; q?: string }): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByEmail(email: string): Promise<Tenant | undefined>;
  createTenant(Tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;
  getTenantsWithLotInfo(filters?: { status?: string; parkId?: string; q?: string }): Promise<any[]>;
  
  // Payment operations
  getPayments(filters?: { tenantId?: string; lotId?: string; status?: string; type?: string }): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment>;
  deletePayment(id: string): Promise<void>;
  getPaymentsWithTenantInfo(filters?: { status?: string; parkId?: string; overdue?: boolean }): Promise<any[]>;
  
  // Company Manager operations
  getParksByCompany(companyId: string): Promise<{ parks: Park[] }>;
  getLotsByCompany(companyId: string): Promise<any[]>;
  getShowingsByCompany(companyId: string, period: 'today' | 'this-week' | 'this-month'): Promise<any[]>;
  getCompanyManagerStats(companyId: string): Promise<any>;
  
  // Login log operations
  createLoginLog(log: InsertLoginLog): Promise<LoginLog>;
  getLoginLogs(filters?: { userId?: string; role?: string; days?: number; success?: boolean; page?: number; limit?: number }): Promise<{ logs: any[]; totalCount: number }>;
  cleanOldLoginLogs(): Promise<void>;
  
  // CRM Contact operations
  getCrmContacts(companyId: string, filters?: { q?: string; parkId?: string; companyId?: string }): Promise<any[]>;
  getAllCrmContacts(filters?: { q?: string; parkId?: string; companyId?: string }): Promise<any[]>;
  getCrmContact(id: string): Promise<CrmContact | undefined>;
  createCrmContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateCrmContact(id: string, updates: Partial<InsertCrmContact>): Promise<CrmContact>;
  deleteCrmContact(id: string): Promise<void>;
  
  // CRM Deal operations
  getCrmDeals(companyId: string, filters?: { stage?: string; assignedTo?: string; contactId?: string; parkId?: string }): Promise<any[]>;
  getAllCrmDeals(filters?: { stage?: string; assignedTo?: string; contactId?: string; parkId?: string; companyId?: string }): Promise<any[]>;
  getCrmDeal(id: string): Promise<CrmDeal | undefined>;
  createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, updates: Partial<InsertCrmDeal>): Promise<CrmDeal>;
  deleteCrmDeal(id: string): Promise<void>;
  
  // CRM Task operations
  getCrmTasks(companyId: string, filters?: { assignedTo?: string; status?: string; entityType?: string; entityId?: string }): Promise<CrmTask[]>;
  getCrmTask(id: string): Promise<CrmTask | undefined>;
  createCrmTask(task: InsertCrmTask): Promise<CrmTask>;
  updateCrmTask(id: string, updates: Partial<InsertCrmTask>): Promise<CrmTask>;
  deleteCrmTask(id: string): Promise<void>;
  
  // CRM Note operations
  getCrmNotes(entityType: string, entityId: string): Promise<CrmNote[]>;
  getCrmNote(id: string): Promise<CrmNote | undefined>;
  createCrmNote(note: InsertCrmNote): Promise<CrmNote>;
  updateCrmNote(id: string, updates: Partial<InsertCrmNote>): Promise<CrmNote>;
  deleteCrmNote(id: string): Promise<void>;
  
  // CRM Activity operations
  getCrmActivities(entityType: string, entityId: string): Promise<CrmActivity[]>;
  createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  
  // CRM Message operations
  getCrmMessages(userId: string, otherUserId?: string): Promise<CrmMessage[]>;
  getCrmMessage(id: string): Promise<CrmMessage | undefined>;
  createCrmMessage(message: InsertCrmMessage): Promise<CrmMessage>;
  markMessageAsRead(id: string): Promise<void>;
  markAllMessagesAsRead(userId: string): Promise<void>;
  getUnreadMessageCount(userId: string): Promise<number>;
  getConversations(userId: string): Promise<any[]>;
  
  // CRM Notification operations
  getNotifications(userId: string, companyId: string): Promise<any>;
  clearTaskNotifications(userId: string): Promise<void>;
  clearMentionNotifications(userId: string): Promise<void>;
  
  // CRM Association operations
  getCrmAssociations(sourceType: string, sourceId: string): Promise<any[]>;
  getCrmAssociation(id: string): Promise<CrmAssociation | undefined>;
  createCrmAssociation(association: InsertCrmAssociation): Promise<CrmAssociation>;
  deleteCrmAssociation(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    // Hash the provided token to compare with stored hash
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [user] = await db.select().from(users).where(eq(users.resetToken, tokenHash));
    return user;
  }

  async getSystemIntegrationUser(): Promise<User | undefined> {
    // Only alem@bluepaperclip.com should manage Google integrations
    const [user] = await db.select().from(users).where(eq(users.email, 'alem@bluepaperclip.com'));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getUserWithTenant(id: string): Promise<any | undefined> {
    const [result] = await db.select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      tenantId: users.tenantId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      tenant: {
        id: tenants.id,
        firstName: tenants.firstName,
        lastName: tenants.lastName,
        email: tenants.email,
        phone: tenants.phone,
        status: tenants.status,
        leaseStartDate: tenants.leaseStartDate,
        leaseEndDate: tenants.leaseEndDate,
        monthlyRent: tenants.monthlyRent,
        securityDeposit: tenants.securityDeposit,
        notes: tenants.notes,
        lotId: tenants.lotId,
      }
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, id));
    
    return result;
  }

  async getUserByTenantId(tenantId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.tenantId, tenantId));
    return user;
  }

  async linkUserToTenant(userId: string, tenantId: string): Promise<User> {
    const [result] = await db.update(users)
      .set({ tenantId })
      .where(eq(users.id, userId))
      .returning();
    return result;
  }

  async getUsers(filters?: { role?: 'MHP_LORD' | 'MANAGER' | 'ADMIN' | 'TENANT' }): Promise<User[]> {
    let query = db.select().from(users);
    const conditions = [];

    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(asc(users.fullName));
    }

    return await query.orderBy(asc(users.fullName));
  }

  async getCompanies(includeInactive?: boolean): Promise<Company[]> {
    if (!includeInactive) {
      return await db.select().from(companies)
        .where(eq(companies.isActive, true))
        .orderBy(asc(companies.name));
    }
    
    return await db.select().from(companies)
      .orderBy(asc(companies.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies)
      .where(and(eq(companies.id, id), eq(companies.isActive, true)));
    return company;
  }

  async getCompanyAny(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies)
      .where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db.update(companies).set({ ...updates, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
    return company;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string; status?: string; minPrice?: number; maxPrice?: number; includeInactive?: boolean }): Promise<{ parks: Park[] }> {
    let query = db.select().from(parks)
      .innerJoin(companies, eq(parks.companyId, companies.id));
    
    const conditions = [];
    
    if (!filters?.includeInactive) {
      conditions.push(eq(parks.isActive, true));
      conditions.push(eq(companies.isActive, true));
    }

    if (filters?.companyId) {
      conditions.push(eq(parks.companyId, filters.companyId));
    }
    if (filters?.city) {
      conditions.push(eq(parks.city, filters.city));
    }
    if (filters?.state) {
      conditions.push(eq(parks.state, filters.state));
    }
    if (filters?.q) {
      const searchTerm = filters.q.toLowerCase();
      conditions.push(
        sql`(
          LOWER(${parks.name}) LIKE ${'%' + searchTerm + '%'} OR
          LOWER(COALESCE(${parks.description}, '')) LIKE ${'%' + searchTerm + '%'} OR
          LOWER(${parks.address}) LIKE ${'%' + searchTerm + '%'}
        )`
      );
    }
    
    // Filter parks based on their lots' status and price
    if (filters?.status || filters?.minPrice || filters?.maxPrice) {
      const lotConditions = [];
      
      // Status filtering - check if the array contains the specific status
      if (filters?.status) {
        lotConditions.push(sql`${filters.status} = ANY(${lots.status})`);
      }
      
      // Price filtering - check all price fields
      if (filters?.minPrice || filters?.maxPrice) {
        const minPrice = filters?.minPrice ? filters.minPrice.toString() : '0';
        const maxPrice = filters?.maxPrice ? filters.maxPrice.toString() : '999999999';
        
        lotConditions.push(sql`(
          (${lots.priceForRent} IS NOT NULL AND ${lots.priceForRent} != '0' AND 
           CAST(${lots.priceForRent} AS DECIMAL) >= ${minPrice} AND 
           CAST(${lots.priceForRent} AS DECIMAL) <= ${maxPrice})
          OR
          (${lots.priceForSale} IS NOT NULL AND ${lots.priceForSale} != '0' AND 
           CAST(${lots.priceForSale} AS DECIMAL) >= ${minPrice} AND 
           CAST(${lots.priceForSale} AS DECIMAL) <= ${maxPrice})
          OR
          (${lots.priceRentToOwn} IS NOT NULL AND ${lots.priceRentToOwn} != '0' AND 
           CAST(${lots.priceRentToOwn} AS DECIMAL) >= ${minPrice} AND 
           CAST(${lots.priceRentToOwn} AS DECIMAL) <= ${maxPrice})
          OR
          (${lots.priceContractForDeed} IS NOT NULL AND ${lots.priceContractForDeed} != '0' AND 
           CAST(${lots.priceContractForDeed} AS DECIMAL) >= ${minPrice} AND 
           CAST(${lots.priceContractForDeed} AS DECIMAL) <= ${maxPrice})
          OR
          (${lots.price} IS NOT NULL AND ${lots.price} != '0' AND 
           CAST(${lots.price} AS DECIMAL) >= ${minPrice} AND 
           CAST(${lots.price} AS DECIMAL) <= ${maxPrice})
        )`);
      }
      
      // Include inactive lot check
      if (!filters?.includeInactive) {
        lotConditions.push(eq(lots.isActive, true));
      }
      
      // Add condition to only include parks that have at least one lot matching the criteria
      const parksWithMatchingLots = db.select({ parkId: lots.parkId })
        .from(lots)
        .where(and(...lotConditions))
        .as('matching_lots');
      
      conditions.push(
        sql`${parks.id} IN (SELECT DISTINCT ${parksWithMatchingLots.parkId} FROM ${parksWithMatchingLots})`
      );
    }

    const results = await query
      .where(and(...conditions))
      .orderBy(asc(parks.name));
    
    // Extract park data and include company information from the joined result
    const parksResult = results.map(row => ({
      id: row.parks.id,
      companyId: row.parks.companyId,
      name: row.parks.name,
      address: row.parks.address,
      city: row.parks.city,
      state: row.parks.state,
      zip: row.parks.zip,
      description: row.parks.description,
      meetingPlace: row.parks.meetingPlace,
      amenities: row.parks.amenities,
      lotRent: row.parks.lotRent,
      isActive: row.parks.isActive,
      createdAt: row.parks.createdAt,
      updatedAt: row.parks.updatedAt,
      company: {
        name: row.companies.name
      }
    }));
    
    // Add lot counts for each park
    const parksWithLotCounts = await Promise.all(parksResult.map(async (park) => {
      const lotCount = await db.select({ count: sql<number>`count(*)` })
        .from(lots)
        .where(and(
          eq(lots.parkId, park.id),
          eq(lots.isActive, true)
        ));
      
      return {
        ...park,
        availableLotsCount: lotCount[0]?.count || 0
      };
    }));
    
    return { parks: parksWithLotCounts };
  }

  async getPark(id: string): Promise<Park | undefined> {
    const results = await db.select()
      .from(parks)
      .innerJoin(companies, eq(parks.companyId, companies.id))
      .where(and(
        eq(parks.id, id),
        eq(parks.isActive, true),
        eq(companies.isActive, true)
      ));
    
    if (results.length === 0) return undefined;
    
    return results[0].parks;
  }

  async getParkAny(id: string): Promise<Park | undefined> {
    const [park] = await db.select().from(parks)
      .where(eq(parks.id, id));
    return park;
  }

  async createPark(park: InsertPark): Promise<Park> {
    const [newPark] = await db.insert(parks).values(park).returning();
    return newPark;
  }

  async updatePark(id: string, updates: Partial<InsertPark>): Promise<Park> {
    const [park] = await db.update(parks).set({ ...updates, updatedAt: new Date() }).where(eq(parks.id, id)).returning();
    return park;
  }

  async deletePark(id: string): Promise<void> {
    await db.delete(parks).where(eq(parks.id, id));
  }

  async getLots(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; includeInactive?: boolean }): Promise<Lot[]> {
    const conditions = [];
    
    if (!filters?.includeInactive) {
      conditions.push(eq(lots.isActive, true));
      conditions.push(eq(parks.isActive, true));
      conditions.push(eq(companies.isActive, true));
    }

    if (filters?.parkId) {
      conditions.push(eq(lots.parkId, filters.parkId));
    }
    if (filters?.status) {
      // Check if the array contains the specific status
      conditions.push(sql`${filters.status} = ANY(${lots.status})`);
    }
    // Price filtering - check all price fields
    if (filters?.minPrice || filters?.maxPrice) {
      const minPrice = filters?.minPrice ? filters.minPrice.toString() : '0';
      const maxPrice = filters?.maxPrice ? filters.maxPrice.toString() : '999999999';
      
      conditions.push(sql`(
        (${lots.priceForRent} IS NOT NULL AND ${lots.priceForRent} != '0' AND 
         CAST(${lots.priceForRent} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceForRent} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceForSale} IS NOT NULL AND ${lots.priceForSale} != '0' AND 
         CAST(${lots.priceForSale} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceForSale} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceRentToOwn} IS NOT NULL AND ${lots.priceRentToOwn} != '0' AND 
         CAST(${lots.priceRentToOwn} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceRentToOwn} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceContractForDeed} IS NOT NULL AND ${lots.priceContractForDeed} != '0' AND 
         CAST(${lots.priceContractForDeed} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceContractForDeed} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.price} IS NOT NULL AND ${lots.price} != '0' AND 
         CAST(${lots.price} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.price} AS DECIMAL) <= ${maxPrice})
      )`);
    }
    if (filters?.bedrooms) {
      conditions.push(eq(lots.bedrooms, filters.bedrooms));
    }
    if (filters?.bathrooms) {
      conditions.push(eq(lots.bathrooms, filters.bathrooms));
    }

    let results;
    
    // Use left joins when including inactive entities to avoid filtering out lots
    // with inactive parks/companies
    if (filters?.includeInactive) {
      results = await db.select().from(lots)
        .leftJoin(parks, eq(lots.parkId, parks.id))
        .leftJoin(companies, eq(parks.companyId, companies.id))
        .where(and(...conditions))
        .orderBy(asc(lots.nameOrNumber));
    } else {
      results = await db.select().from(lots)
        .innerJoin(parks, eq(lots.parkId, parks.id))
        .innerJoin(companies, eq(parks.companyId, companies.id))
        .where(and(...conditions))
        .orderBy(asc(lots.nameOrNumber));
    }
    
    // Extract only lot data from the joined result
    return results.map(row => row.lots);
  }

  async getLotsWithParkInfo(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; state?: string; q?: string; includeInactive?: boolean }): Promise<any[]> {
    const selectFields = {
      id: lots.id,
      nameOrNumber: lots.nameOrNumber,
      status: lots.status,
      price: lots.price,
      priceForRent: lots.priceForRent,
      priceForSale: lots.priceForSale,
      priceRentToOwn: lots.priceRentToOwn,
      priceContractForDeed: lots.priceContractForDeed,
      depositForRent: lots.depositForRent,
      depositForSale: lots.depositForSale,
      depositRentToOwn: lots.depositRentToOwn,
      depositContractForDeed: lots.depositContractForDeed,
      downPaymentContractForDeed: lots.downPaymentContractForDeed,
      lotRent: lots.lotRent,
      promotionalPrice: lots.promotionalPrice,
      promotionalPriceActive: lots.promotionalPriceActive,
      estimatedPayment: lots.estimatedPayment,
      availableDate: lots.availableDate,
      mobileHomeYear: lots.mobileHomeYear,
      mobileHomeSize: lots.mobileHomeSize,
      showingLink: lots.showingLink,
      description: lots.description,
      bedrooms: lots.bedrooms,
      bathrooms: lots.bathrooms,
      sqFt: lots.sqFt,
      houseManufacturer: lots.houseManufacturer,
      houseModel: lots.houseModel,
      facebookPostId: lots.facebookPostId,
      facebookAdStatus: lots.facebookAdStatus,
      facebookPublishedDate: lots.facebookPublishedDate,
      facebookPublishedUntil: lots.facebookPublishedUntil,
      isActive: lots.isActive,
      parkId: lots.parkId,
      specialStatusId: lots.specialStatusId,
      createdAt: lots.createdAt,
      updatedAt: lots.updatedAt,
      park: {
        id: parks.id,
        name: parks.name,
        address: parks.address,
        city: parks.city,
        state: parks.state
      },
      specialStatus: {
        id: specialStatuses.id,
        name: specialStatuses.name,
        color: specialStatuses.color,
        isActive: specialStatuses.isActive
      },
      // Add tenant assignment info
      tenantId: tenants.id,
      tenantName: sql<string>`CONCAT(${tenants.firstName}, ' ', ${tenants.lastName})`,
      tenantStatus: tenants.status,
      isAssigned: sql<boolean>`CASE WHEN ${tenants.id} IS NOT NULL THEN true ELSE false END`
    };
    
    const conditions = [];
    
    if (!filters?.includeInactive) {
      conditions.push(eq(lots.isActive, true));
      conditions.push(eq(parks.isActive, true));
      conditions.push(eq(companies.isActive, true));
    }

    if (filters?.parkId) {
      conditions.push(eq(lots.parkId, filters.parkId));
    }
    if (filters?.status) {
      // Check if the array contains the specific status
      conditions.push(sql`${filters.status} = ANY(${lots.status})`);
    }
    // Price filtering - check all price fields
    if (filters?.minPrice || filters?.maxPrice) {
      const minPrice = filters?.minPrice ? filters.minPrice.toString() : '0';
      const maxPrice = filters?.maxPrice ? filters.maxPrice.toString() : '999999999';
      
      conditions.push(sql`(
        (${lots.priceForRent} IS NOT NULL AND ${lots.priceForRent} != '0' AND 
         CAST(${lots.priceForRent} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceForRent} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceForSale} IS NOT NULL AND ${lots.priceForSale} != '0' AND 
         CAST(${lots.priceForSale} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceForSale} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceRentToOwn} IS NOT NULL AND ${lots.priceRentToOwn} != '0' AND 
         CAST(${lots.priceRentToOwn} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceRentToOwn} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.priceContractForDeed} IS NOT NULL AND ${lots.priceContractForDeed} != '0' AND 
         CAST(${lots.priceContractForDeed} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.priceContractForDeed} AS DECIMAL) <= ${maxPrice})
        OR
        (${lots.price} IS NOT NULL AND ${lots.price} != '0' AND 
         CAST(${lots.price} AS DECIMAL) >= ${minPrice} AND 
         CAST(${lots.price} AS DECIMAL) <= ${maxPrice})
      )`);
    }
    if (filters?.bedrooms) {
      conditions.push(eq(lots.bedrooms, filters.bedrooms));
    }
    if (filters?.bathrooms) {
      conditions.push(eq(lots.bathrooms, filters.bathrooms));
    }
    if (filters?.state) {
      conditions.push(eq(parks.state, filters.state));
    }
    if (filters?.q) {
      const searchTerm = filters.q.toLowerCase();
      conditions.push(
        sql`(
          LOWER(${lots.nameOrNumber}) LIKE ${'%' + searchTerm + '%'} OR
          LOWER(${parks.name}) LIKE ${'%' + searchTerm + '%'} OR
          LOWER(COALESCE(${lots.description}, '')) LIKE ${'%' + searchTerm + '%'}
        )`
      );
    }

    // Use left joins when including inactive entities to avoid filtering out lots
    // with inactive parks/companies
    let result;
    
    if (filters?.includeInactive) {
      if (conditions.length > 0) {
        result = await db.select(selectFields).from(lots)
          .leftJoin(parks, eq(lots.parkId, parks.id))
          .leftJoin(companies, eq(parks.companyId, companies.id))
          .leftJoin(specialStatuses, eq(lots.specialStatusId, specialStatuses.id))
          .leftJoin(tenants, eq(lots.id, tenants.lotId))
          .where(and(...conditions))
          .orderBy(asc(lots.nameOrNumber));
      } else {
        result = await db.select(selectFields).from(lots)
          .leftJoin(parks, eq(lots.parkId, parks.id))
          .leftJoin(companies, eq(parks.companyId, companies.id))
          .leftJoin(specialStatuses, eq(lots.specialStatusId, specialStatuses.id))
          .leftJoin(tenants, eq(lots.id, tenants.lotId))
          .orderBy(asc(lots.nameOrNumber));
      }
      console.log(`getLotsWithParkInfo (includeInactive=true): Found ${result.length} lots`);
    } else {
      if (conditions.length > 0) {
        result = await db.select(selectFields).from(lots)
          .innerJoin(parks, eq(lots.parkId, parks.id))
          .innerJoin(companies, eq(parks.companyId, companies.id))
          .leftJoin(specialStatuses, eq(lots.specialStatusId, specialStatuses.id))
          .leftJoin(tenants, eq(lots.id, tenants.lotId))
          .where(and(...conditions))
          .orderBy(asc(lots.nameOrNumber));
      } else {
        result = await db.select(selectFields).from(lots)
          .innerJoin(parks, eq(lots.parkId, parks.id))
          .innerJoin(companies, eq(parks.companyId, companies.id))
          .leftJoin(specialStatuses, eq(lots.specialStatusId, specialStatuses.id))
          .leftJoin(tenants, eq(lots.id, tenants.lotId))
          .orderBy(asc(lots.nameOrNumber));
      }
      console.log(`getLotsWithParkInfo (includeInactive=false): Found ${result.length} lots`);
    }
    return result;
  }

  async getLot(id: string): Promise<Lot | undefined> {
    try {
      const results = await db.select()
        .from(lots)
        .innerJoin(parks, eq(lots.parkId, parks.id))
        .innerJoin(companies, eq(parks.companyId, companies.id))
        .where(and(
          eq(lots.id, id),
          eq(lots.isActive, true),
          eq(parks.isActive, true),
          eq(companies.isActive, true)
        ));
      
      if (results.length === 0) return undefined;
      
      return results[0].lots;
    } catch (error) {
      console.error('Error in getLot:', error);
      console.error('Lot ID:', id);
      
      // If the error is due to missing columns, try a simpler query with only core fields
      if (error instanceof Error && error.message && error.message.includes('column')) {
        console.log('Attempting fallback query with core fields only');
        try {
          const fallbackResults = await db.select({
            id: lots.id,
            nameOrNumber: lots.nameOrNumber,
            status: lots.status,
            price: lots.price,
            priceForRent: lots.priceForRent,
            priceForSale: lots.priceForSale,
            priceRentToOwn: lots.priceRentToOwn,
            priceContractForDeed: lots.priceContractForDeed,
            lotRent: lots.lotRent,
            promotionalPrice: lots.promotionalPrice,
            promotionalPriceActive: lots.promotionalPriceActive,
            estimatedPayment: lots.estimatedPayment,
            availableDate: lots.availableDate,
            mobileHomeYear: lots.mobileHomeYear,
            mobileHomeSize: lots.mobileHomeSize,
            description: lots.description,
            bedrooms: lots.bedrooms,
            bathrooms: lots.bathrooms,
            sqFt: lots.sqFt,
            houseManufacturer: lots.houseManufacturer,
            houseModel: lots.houseModel,
            parkId: lots.parkId,
            isActive: lots.isActive,
            specialStatusId: lots.specialStatusId,
            showingLink: lots.showingLink,
            facebookPostId: lots.facebookPostId
          })
          .from(lots)
          .innerJoin(parks, eq(lots.parkId, parks.id))
          .innerJoin(companies, eq(parks.companyId, companies.id))
          .where(and(
            eq(lots.id, id),
            eq(lots.isActive, true),
            eq(parks.isActive, true),
            eq(companies.isActive, true)
          ));
          
          if (fallbackResults.length === 0) return undefined;
          
          return fallbackResults[0];
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  async getLotAny(id: string): Promise<Lot | undefined> {
    const [lot] = await db.select().from(lots)
      .where(eq(lots.id, id));
    return lot;
  }

  async createLot(lot: InsertLot): Promise<Lot> {
    const [newLot] = await db.insert(lots).values(lot).returning();
    return newLot;
  }

  async updateLot(id: string, updates: Partial<InsertLot>): Promise<Lot> {
    const [lot] = await db.update(lots).set({ ...updates, updatedAt: new Date() }).where(eq(lots.id, id)).returning();
    return lot;
  }

  async updateLotRentForPark(parkId: string, lotRent: string): Promise<void> {
    await db.update(lots)
      .set({ lotRent, updatedAt: new Date() })
      .where(eq(lots.parkId, parkId));
  }

  async deleteLot(id: string): Promise<void> {
    // Delete all related records first to avoid foreign key constraint violations
    
    // First, get all tenants for this lot
    const lotTenants = await db.select().from(tenants).where(eq(tenants.lotId, id));
    const tenantIds = lotTenants.map(t => t.id);
    
    // Update users that reference these tenants (set tenantId to null)
    if (tenantIds.length > 0) {
      await db.update(users)
        .set({ tenantId: null })
        .where(inArray(users.tenantId, tenantIds));
    }
    
    // Delete photos associated with this lot
    await db.delete(photos).where(
      and(
        eq(photos.entityType, 'LOT'),
        eq(photos.entityId, id)
      )
    );
    
    // Delete showings for this lot
    await db.delete(showings).where(eq(showings.lotId, id));
    
    // Delete availability rules for this lot
    await db.delete(availability).where(eq(availability.lotId, id));
    
    // Delete payments for this lot
    await db.delete(payments).where(eq(payments.lotId, id));
    
    // Delete tenants for this lot
    await db.delete(tenants).where(eq(tenants.lotId, id));
    
    // Finally, delete the lot itself
    await db.delete(lots).where(eq(lots.id, id));
  }

  async getAuditLogs(entityType: string, entityId: string, limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId)
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getShowings(filters?: { lotId?: string; managerId?: string; status?: string }): Promise<any[]> {
    let query = db.select({
      id: showings.id,
      startDt: showings.startDt,
      endDt: showings.endDt,
      status: showings.status,
      clientName: showings.clientName,
      clientEmail: showings.clientEmail,
      clientPhone: showings.clientPhone,
      createdAt: showings.createdAt,
      calendarEventId: showings.calendarEventId,
      lotId: lots.id,
      lotNameOrNumber: lots.nameOrNumber,
      parkId: parks.id,
      parkName: parks.name,
      managerId: users.id,
      managerName: users.fullName,
    }).from(showings)
      .leftJoin(lots, eq(showings.lotId, lots.id))
      .leftJoin(parks, eq(lots.parkId, parks.id))
      .leftJoin(users, eq(showings.managerId, users.id));
      
    const conditions = [];

    if (filters?.lotId) {
      conditions.push(eq(showings.lotId, filters.lotId));
    }
    if (filters?.managerId) {
      conditions.push(eq(showings.managerId, filters.managerId));
    }
    if (filters?.status) {
      conditions.push(eq(showings.status, filters.status as any));
    }

    if (conditions.length > 0) {
      const results = await query.where(and(...conditions)).orderBy(desc(showings.startDt));
      return results.map(row => ({
        id: row.id,
        startDt: row.startDt,
        endDt: row.endDt,
        status: row.status,
        customerName: row.clientName,
        customerEmail: row.clientEmail,
        customerPhone: row.clientPhone,
        createdAt: row.createdAt,
        calendarEventId: row.calendarEventId,
        lot: {
          id: row.lotId,
          nameOrNumber: row.lotNameOrNumber,
          park: {
            id: row.parkId,
            name: row.parkName,
          },
        },
        manager: row.managerId ? {
          id: row.managerId,
          fullName: row.managerName,
        } : null,
      }));
    }

    const results = await query.orderBy(desc(showings.startDt));
    return results.map(row => ({
      id: row.id,
      startDt: row.startDt,
      endDt: row.endDt,
      status: row.status,
      customerName: row.clientName,
      customerEmail: row.clientEmail,
      customerPhone: row.clientPhone,
      createdAt: row.createdAt,
      calendarEventId: row.calendarEventId,
      lot: {
        id: row.lotId,
        nameOrNumber: row.lotNameOrNumber,
        park: {
          id: row.parkId,
          name: row.parkName,
        },
      },
      manager: row.managerId ? {
        id: row.managerId,
        fullName: row.managerName,
      } : null,
    }));
  }

  async getShowing(id: string): Promise<Showing | undefined> {
    const [showing] = await db.select().from(showings).where(eq(showings.id, id));
    return showing;
  }

  async createShowing(showing: InsertShowing): Promise<Showing> {
    const [newShowing] = await db.insert(showings).values(showing).returning();
    return newShowing;
  }

  async updateShowing(id: string, updates: Partial<InsertShowing>): Promise<Showing> {
    const [showing] = await db.update(showings).set(updates).where(eq(showings.id, id)).returning();
    return showing;
  }

  async deleteShowing(id: string): Promise<void> {
    await db.delete(showings).where(eq(showings.id, id));
  }

  async getScheduledShowingsWithCalendarIds(): Promise<Showing[]> {
    const results = await db.select().from(showings)
      .where(
        and(
          eq(showings.status, 'SCHEDULED'),
          isNotNull(showings.calendarEventId)
        )
      )
      .orderBy(asc(showings.startDt));
    
    return results;
  }

  async checkShowingOverlap(lotId: string, startDt: Date, endDt: Date, excludeId?: string): Promise<boolean> {
    // Use STRICT overlap logic: events that touch boundaries (e.g., 9:30-10:00 and 10:00-10:30) should NOT conflict
    // Only detect REAL overlaps where times actually intersect, not just touch
    const conditions = [
      eq(showings.lotId, lotId),
      or(
        and(sql`${showings.startDt} > ${startDt}`, sql`${showings.startDt} < ${endDt}`), // showing starts during slot (not at boundary)
        and(sql`${showings.endDt} > ${startDt}`, sql`${showings.endDt} < ${endDt}`),     // showing ends during slot (not at boundary)
        and(lte(showings.startDt, startDt), gte(showings.endDt, endDt))                   // showing wraps entire slot
      ),
      eq(showings.status, 'SCHEDULED')
    ];

    if (excludeId) {
      conditions.push(sql`${showings.id} != ${excludeId}`);
    }

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(showings)
      .where(and(...conditions));
    
    return result.count > 0;
  }

  async getAvailability(lotId: string): Promise<Availability[]> {
    return await db.select().from(availability)
      .where(eq(availability.lotId, lotId))
      .orderBy(asc(availability.startDt));
  }

  async createAvailability(availabilityData: InsertAvailability): Promise<Availability> {
    const [newAvailability] = await db.insert(availability).values(availabilityData).returning();
    return newAvailability;
  }

  async deleteAvailability(id: string): Promise<void> {
    await db.delete(availability).where(eq(availability.id, id));
  }

  async getPhotos(entityType: string, entityId: string): Promise<Photo[]> {
    return await db.select().from(photos)
      .where(and(eq(photos.entityType, entityType as any), eq(photos.entityId, entityId)))
      .orderBy(asc(photos.sortOrder));
  }

  async getPhotosByFilename(filename: string): Promise<Photo[]> {
    return await db.select().from(photos)
      .where(like(photos.urlOrPath, `%${filename}`));
  }

  async getPhoto(id: string): Promise<Photo | null> {
    const result = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
    return result[0] || null;
  }

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    const [newPhoto] = await db.insert(photos).values(photo).returning();
    return newPhoto;
  }

  async updatePhoto(id: string, updates: Partial<InsertPhoto>): Promise<Photo> {
    console.log('Storage updatePhoto called with:', { id, updates });
    const [photo] = await db.update(photos).set(updates).where(eq(photos.id, id)).returning();
    console.log('Storage updatePhoto result:', photo);
    if (!photo) {
      throw new Error(`Photo with id ${id} not found or update failed`);
    }
    return photo;
  }

  async deletePhoto(id: string): Promise<void> {
    await db.delete(photos).where(eq(photos.id, id));
  }

  async reorderPhotos(entityType: string, entityId: string, photoOrders: Array<{id: string, sortOrder: number}>): Promise<void> {
    // Update all photos in a transaction
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of photoOrders) {
        await tx.update(photos)
          .set({ sortOrder })
          .where(and(
            eq(photos.id, id),
            eq(photos.entityType, entityType as any),
            eq(photos.entityId, entityId)
          ));
      }
    });
  }

  async getInvites(): Promise<Invite[]> {
    return await db.select().from(invites).orderBy(asc(invites.email));
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    return invite;
  }

  async createInvite(invite: InsertInvite & { token: string; expiresAt: Date }): Promise<Invite> {
    const [newInvite] = await db.insert(invites).values(invite).returning();
    return newInvite;
  }

  async acceptInvite(token: string): Promise<Invite> {
    const [invite] = await db.update(invites)
      .set({ acceptedAt: new Date() })
      .where(eq(invites.token, token))
      .returning();
    return invite;
  }

  async getInvite(id: string): Promise<Invite | undefined> {
    const [invite] = await db.select().from(invites).where(eq(invites.id, id));
    return invite;
  }

  async getInviteByEmail(email: string): Promise<Invite | undefined> {
    const [invite] = await db.select().from(invites).where(eq(invites.email, email));
    return invite;
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.companyId, companyId)).orderBy(asc(users.fullName));
  }

  async getInvitesByCompany(companyId: string): Promise<Invite[]> {
    // Get invites that either have the companyId set OR were created by users from the same company
    const companyInvites = await db.select().from(invites).where(eq(invites.companyId, companyId));
    
    // Also get invites created by users from this company (for backward compatibility)
    const companyUsers = await db.select({ id: users.id }).from(users).where(eq(users.companyId, companyId));
    const companyUserIds = companyUsers.map(u => u.id);
    
    let additionalInvites: Invite[] = [];
    if (companyUserIds.length > 0) {
      additionalInvites = await db.select().from(invites).where(
        and(
          isNull(invites.companyId),
          inArray(invites.createdByUserId, companyUserIds)
        )
      );
    }
    
    // Combine and deduplicate
    const allInvites = [...companyInvites, ...additionalInvites];
    const uniqueInvites = allInvites.filter((invite, index, self) => 
      index === self.findIndex(i => i.id === invite.id)
    );
    
    // Sort alphabetically by email
    return uniqueInvites.sort((a, b) => a.email.toLowerCase().localeCompare(b.email.toLowerCase()));
  }

  async getManagerAssignments(userId?: string, parkId?: string): Promise<any[]> {
    let query = db.select({
      id: managerAssignments.id,
      userId: managerAssignments.userId,
      parkId: managerAssignments.parkId,
      userName: users.fullName,
      userEmail: users.email,
      parkName: parks.name,
    }).from(managerAssignments)
      .leftJoin(users, eq(managerAssignments.userId, users.id))
      .leftJoin(parks, eq(managerAssignments.parkId, parks.id));

    const conditions = [];
    if (userId) {
      conditions.push(eq(managerAssignments.userId, userId));
    }
    if (parkId) {
      conditions.push(eq(managerAssignments.parkId, parkId));
    }

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(asc(parks.name), asc(users.fullName));
    }

    return await query.orderBy(asc(parks.name), asc(users.fullName));
  }

  async assignManagerToPark(userId: string, parkId: string): Promise<void> {
    await db.insert(managerAssignments).values({ userId, parkId });
  }

  async removeManagerFromPark(userId: string, parkId: string): Promise<void> {
    await db.delete(managerAssignments)
      .where(and(eq(managerAssignments.userId, userId), eq(managerAssignments.parkId, parkId)));
  }

  async getAllManagerAssignments(): Promise<any[]> {
    return await this.getManagerAssignments();
  }

  async removeManagerAssignments(userId: string): Promise<void> {
    await db.delete(managerAssignments)
      .where(eq(managerAssignments.userId, userId));
  }

  async deleteUser(id: string): Promise<void> {
    // Delete all related data before deleting the user to avoid foreign key constraint violations
    
    // 1. Remove manager assignments
    await this.removeManagerAssignments(id);
    
    // 2. Delete Google Calendar tokens
    await db.delete(googleCalendarTokens).where(eq(googleCalendarTokens.userId, id));
    
    // 3. Delete showings where user is the manager
    await db.delete(showings).where(eq(showings.managerId, id));
    
    // 4. Delete OAuth accounts
    await db.delete(oauthAccounts).where(eq(oauthAccounts.userId, id));
    
    // 5. Delete invites created by this user
    await db.delete(invites).where(eq(invites.createdByUserId, id));
    
    // 6. Delete CRM messages (as sender or receiver)
    await db.delete(crmMessages).where(eq(crmMessages.senderId, id));
    await db.delete(crmMessages).where(eq(crmMessages.receiverId, id));
    
    // 7. Delete CRM activities
    await db.delete(crmActivities).where(eq(crmActivities.userId, id));
    
    // 8. Delete audit logs
    await db.delete(auditLogs).where(eq(auditLogs.userId, id));
    
    // 9. Delete CRM tasks assigned to or created by this user
    await db.delete(crmTasks).where(eq(crmTasks.assignedTo, id));
    await db.delete(crmTasks).where(eq(crmTasks.createdBy, id));
    
    // 10. Delete CRM deals assigned to or created by this user
    await db.delete(crmDeals).where(eq(crmDeals.assignedTo, id));
    await db.delete(crmDeals).where(eq(crmDeals.createdBy, id));
    
    // 11. Delete CRM notes created by this user
    await db.delete(crmNotes).where(eq(crmNotes.createdBy, id));
    
    // 12. Delete CRM contacts created by this user
    await db.delete(crmContacts).where(eq(crmContacts.createdBy, id));
    
    // 13. Delete CRM associations created by this user
    await db.delete(crmAssociations).where(eq(crmAssociations.createdBy, id));
    
    // Note: loginLogs has onDelete: 'set null', so it's handled automatically by the database
    
    // Finally, delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async deleteInvite(id: string): Promise<void> {
    await db.delete(invites).where(eq(invites.id, id));
  }

  async getOAuthAccount(userId: string, provider: string): Promise<OAuthAccount | undefined> {
    const [account] = await db.select().from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
    return account;
  }

  async createOrUpdateOAuthAccount(userId: string, data: Partial<OAuthAccount>): Promise<OAuthAccount> {
    const existing = await this.getOAuthAccount(userId, data.provider!);
    
    if (existing) {
      const [account] = await db.update(oauthAccounts)
        .set(data)
        .where(eq(oauthAccounts.id, existing.id))
        .returning();
      return account;
    } else {
      const [account] = await db.insert(oauthAccounts)
        .values({ userId, ...data } as any)
        .returning();
      return account;
    }
  }

  async deleteOAuthAccount(userId: string, provider: string): Promise<void> {
    await db.delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
  }

  async getGoogleCalendarToken(userId: string): Promise<GoogleCalendarToken | undefined> {
    const [token] = await db.select().from(googleCalendarTokens)
      .where(eq(googleCalendarTokens.userId, userId));
    return token;
  }

  async createOrUpdateGoogleCalendarToken(userId: string, tokenData: InsertGoogleCalendarToken): Promise<GoogleCalendarToken> {
    const existing = await this.getGoogleCalendarToken(userId);
    
    if (existing) {
      const [token] = await db.update(googleCalendarTokens)
        .set({ ...tokenData, updatedAt: new Date() })
        .where(eq(googleCalendarTokens.userId, userId))
        .returning();
      return token;
    } else {
      const [token] = await db.insert(googleCalendarTokens)
        .values({ ...tokenData, userId })
        .returning();
      return token;
    }
  }

  async deleteGoogleCalendarToken(userId: string): Promise<void> {
    await db.delete(googleCalendarTokens)
      .where(eq(googleCalendarTokens.userId, userId));
  }

  // Special Status operations
  async getSpecialStatuses(parkId: string, includeInactive?: boolean): Promise<SpecialStatus[]> {
    const conditions = [eq(specialStatuses.parkId, parkId)];
    
    if (!includeInactive) {
      conditions.push(eq(specialStatuses.isActive, true));
    }
    
    return await db.select().from(specialStatuses)
      .where(and(...conditions))
      .orderBy(asc(specialStatuses.name));
  }

  async getSpecialStatus(id: string): Promise<SpecialStatus | undefined> {
    const [specialStatus] = await db.select().from(specialStatuses).where(eq(specialStatuses.id, id));
    return specialStatus;
  }

  async getSpecialStatusByName(parkId: string, name: string): Promise<SpecialStatus | undefined> {
    const [specialStatus] = await db.select().from(specialStatuses)
      .where(and(
        eq(specialStatuses.parkId, parkId),
        eq(specialStatuses.name, name.trim()),
        eq(specialStatuses.isActive, true)
      ));
    return specialStatus;
  }

  async findOrCreateSpecialStatus(parkId: string, name: string): Promise<SpecialStatus> {
    // First try to find existing special status
    const existing = await this.getSpecialStatusByName(parkId, name);
    if (existing) {
      return existing;
    }

    // Create new special status if it doesn't exist
    return await this.createSpecialStatus({
      parkId,
      name: name.trim(),
      isActive: true
    });
  }

  async createSpecialStatus(specialStatus: InsertSpecialStatus): Promise<SpecialStatus> {
    const [result] = await db.insert(specialStatuses).values(specialStatus).returning();
    return result;
  }

  async updateSpecialStatus(id: string, updates: Partial<InsertSpecialStatus>): Promise<SpecialStatus> {
    const [result] = await db.update(specialStatuses)
      .set(updates)
      .where(eq(specialStatuses.id, id))
      .returning();
    return result;
  }

  async deleteSpecialStatus(id: string): Promise<void> {
    // First, remove special status from any lots that are using it
    await db.update(lots)
      .set({ specialStatusId: null, updatedAt: new Date() })
      .where(eq(lots.specialStatusId, id));
    
    // Then delete the special status
    await db.delete(specialStatuses).where(eq(specialStatuses.id, id));
  }

  // Tenant operations
  async getTenants(filters?: { lotId?: string; status?: string; q?: string }): Promise<Tenant[]> {
    const conditions = [];

    if (filters?.lotId) {
      conditions.push(eq(tenants.lotId, filters.lotId));
    }

    if (filters?.status) {
      conditions.push(eq(tenants.status, filters.status as any));
    }

    if (filters?.q) {
      const searchTerm = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(tenants.firstName, searchTerm),
          ilike(tenants.lastName, searchTerm),
          ilike(tenants.email, searchTerm),
          ilike(tenants.phone, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      return db.select().from(tenants).where(and(...conditions)).orderBy(asc(tenants.lastName), asc(tenants.firstName));
    }

    return db.select().from(tenants).orderBy(asc(tenants.lastName), asc(tenants.firstName));
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [Tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return Tenant;
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    const [Tenant] = await db.select().from(tenants).where(eq(tenants.email, email));
    return Tenant;
  }

  async createTenant(Tenant: InsertTenant): Promise<Tenant> {
    console.log('Storage createTenant called with:', Tenant);
    
    // Extra cleanup to ensure no empty strings go to numeric fields
    const cleanTenant = {
      ...Tenant,
      monthlyRent: Tenant.monthlyRent === '' ? null : Tenant.monthlyRent,
      securityDeposit: Tenant.securityDeposit === '' ? null : Tenant.securityDeposit,
      emergencyContactName: Tenant.emergencyContactName === '' ? null : Tenant.emergencyContactName,
      emergencyContactPhone: Tenant.emergencyContactPhone === '' ? null : Tenant.emergencyContactPhone,
      notes: Tenant.notes === '' ? null : Tenant.notes,
      updatedAt: new Date(),
    };
    
    console.log('Cleaned Tenant for DB:', cleanTenant);
    
    const [result] = await db.insert(tenants).values(cleanTenant).returning();
    return result;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant> {
    const [result] = await db.update(tenants)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();
    return result;
  }

  async deleteTenant(id: string): Promise<void> {
    // First, find and delete any TENANT users that reference this tenant
    const usersToDelete = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, id), eq(users.role, 'TENANT')));
    
    // Delete the TENANT users (this will automatically unlink them from the tenant)
    for (const user of usersToDelete) {
      await db.delete(users).where(eq(users.id, user.id));
    }
    
    // Unlink any remaining users (non-TENANT users) that might reference this tenant
    await db.update(users)
      .set({ tenantId: null })
      .where(eq(users.tenantId, id));
    
    // Then delete associated payments
    await db.delete(payments).where(eq(payments.tenantId, id));
    
    // Finally delete the tenant
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getTenantsWithLotInfo(filters?: { status?: string; parkId?: string; q?: string }): Promise<any[]> {
    const baseQuery = db.select({
      id: tenants.id,
      firstName: tenants.firstName,
      lastName: tenants.lastName,
      email: tenants.email,
      phone: tenants.phone,
      emergencyContactName: tenants.emergencyContactName,
      emergencyContactPhone: tenants.emergencyContactPhone,
      status: tenants.status,
      leaseStartDate: tenants.leaseStartDate,
      leaseEndDate: tenants.leaseEndDate,
      monthlyRent: tenants.monthlyRent,
      securityDeposit: tenants.securityDeposit,
      notes: tenants.notes,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
      lot: {
        id: lots.id,
        nameOrNumber: lots.nameOrNumber,
        description: lots.description,
        parkId: lots.parkId,
      },
      park: {
        id: parks.id,
        name: parks.name,
        city: parks.city,
        state: parks.state,
      },
    })
    .from(tenants)
    .leftJoin(lots, eq(tenants.lotId, lots.id))
    .leftJoin(parks, eq(lots.parkId, parks.id));

    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(tenants.status, filters.status as any));
    }

    if (filters?.parkId) {
      conditions.push(eq(parks.id, filters.parkId));
    }

    if (filters?.q) {
      const searchTerm = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(tenants.firstName, searchTerm),
          ilike(tenants.lastName, searchTerm),
          ilike(tenants.email, searchTerm),
          ilike(tenants.phone, searchTerm),
          ilike(lots.nameOrNumber, searchTerm),
          ilike(parks.name, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      return baseQuery.where(and(...conditions)).orderBy(asc(tenants.lastName), asc(tenants.firstName));
    }

    return baseQuery.orderBy(asc(tenants.lastName), asc(tenants.firstName));
  }

  // Payment operations
  async getPayments(filters?: { tenantId?: string; lotId?: string; status?: string; type?: string }): Promise<Payment[]> {
    const conditions = [];

    if (filters?.tenantId) {
      conditions.push(eq(payments.tenantId, filters.tenantId));
    }

    if (filters?.lotId) {
      conditions.push(eq(payments.lotId, filters.lotId));
    }

    if (filters?.status) {
      conditions.push(eq(payments.status, filters.status as any));
    }

    if (filters?.type) {
      conditions.push(eq(payments.type, filters.type as any));
    }

    if (conditions.length > 0) {
      return db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.dueDate));
    }

    return db.select().from(payments).orderBy(desc(payments.dueDate));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [result] = await db.insert(payments).values({
      ...payment,
      updatedAt: new Date(),
    }).returning();
    return result;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment> {
    const [result] = await db.update(payments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();
    return result;
  }

  async deletePayment(id: string): Promise<void> {
    await db.delete(payments).where(eq(payments.id, id));
  }

  async getPaymentsWithTenantInfo(filters?: { status?: string; parkId?: string; overdue?: boolean }): Promise<any[]> {
    const baseQuery = db.select({
      id: payments.id,
      type: payments.type,
      amount: payments.amount,
      dueDate: payments.dueDate,
      paidDate: payments.paidDate,
      status: payments.status,
      description: payments.description,
      notes: payments.notes,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      Tenant: {
        id: tenants.id,
        firstName: tenants.firstName,
        lastName: tenants.lastName,
        email: tenants.email,
        phone: tenants.phone,
        status: tenants.status,
      },
      lot: {
        id: lots.id,
        nameOrNumber: lots.nameOrNumber,
        parkId: lots.parkId,
      },
      park: {
        id: parks.id,
        name: parks.name,
        city: parks.city,
        state: parks.state,
      },
    })
    .from(payments)
    .leftJoin(tenants, eq(payments.tenantId, tenants.id))
    .leftJoin(lots, eq(payments.lotId, lots.id))
    .leftJoin(parks, eq(lots.parkId, parks.id));

    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(payments.status, filters.status as any));
    }

    if (filters?.parkId) {
      conditions.push(eq(parks.id, filters.parkId));
    }

    if (filters?.overdue) {
      conditions.push(
        and(
          eq(payments.status, 'OVERDUE'),
          lte(payments.dueDate, new Date())
        )
      );
    }

    if (conditions.length > 0) {
      return baseQuery.where(and(...conditions)).orderBy(desc(payments.dueDate));
    }

    return baseQuery.orderBy(desc(payments.dueDate));
  }

  async getTenantByUserId(userId: string): Promise<any | undefined> {
    const [Tenant] = await db.select().from(tenants)
      .innerJoin(users, eq(users.email, tenants.email))
      .where(eq(users.id, userId));
    return Tenant ? Tenant.tenants : undefined;
  }

  // Company Manager operations
  async getParksByCompany(companyId: string): Promise<{ parks: Park[] }> {
    const results = await db.select()
      .from(parks)
      .innerJoin(companies, eq(parks.companyId, companies.id))
      .where(eq(parks.companyId, companyId))
      .orderBy(asc(parks.name));
    
    // Extract park data and include company information from the joined result
    const parksResult = results.map(row => ({
      id: row.parks.id,
      companyId: row.parks.companyId,
      name: row.parks.name,
      address: row.parks.address,
      city: row.parks.city,
      state: row.parks.state,
      zip: row.parks.zip,
      description: row.parks.description,
      meetingPlace: row.parks.meetingPlace,
      amenities: row.parks.amenities,
      lotRent: row.parks.lotRent,
      isActive: row.parks.isActive,
      createdAt: row.parks.createdAt,
      updatedAt: row.parks.updatedAt,
      company: {
        name: row.companies.name
      }
    }));
    
    return { parks: parksResult };
  }

  async getLotsByCompany(companyId: string): Promise<any[]> {
    const lotsWithInfo = await db.select({
      id: lots.id,
      parkId: lots.parkId,
      nameOrNumber: lots.nameOrNumber,
      status: lots.status,
      price: lots.price,
      priceForRent: lots.priceForRent,
      priceForSale: lots.priceForSale,
      priceRentToOwn: lots.priceRentToOwn,
      priceContractForDeed: lots.priceContractForDeed,
      depositForRent: lots.depositForRent,
      depositForSale: lots.depositForSale,
      depositRentToOwn: lots.depositRentToOwn,
      depositContractForDeed: lots.depositContractForDeed,
      downPaymentContractForDeed: lots.downPaymentContractForDeed,
      lotRent: lots.lotRent,
      promotionalPrice: lots.promotionalPrice,
      promotionalPriceActive: lots.promotionalPriceActive,
      estimatedPayment: lots.estimatedPayment,
      availableDate: lots.availableDate,
      mobileHomeYear: lots.mobileHomeYear,
      mobileHomeSize: lots.mobileHomeSize,
      showingLink: lots.showingLink,
      description: lots.description,
      bedrooms: lots.bedrooms,
      bathrooms: lots.bathrooms,
      sqFt: lots.sqFt,
      houseManufacturer: lots.houseManufacturer,
      houseModel: lots.houseModel,
      specialStatusId: lots.specialStatusId,
      facebookPostId: lots.facebookPostId,
      isActive: lots.isActive,
      createdAt: lots.createdAt,
      updatedAt: lots.updatedAt,
      park: {
        id: parks.id,
        name: parks.name,
        address: parks.address,
        city: parks.city,
        state: parks.state,
        zip: parks.zip,
        companyId: parks.companyId,
      },
      specialStatus: {
        id: specialStatuses.id,
        name: specialStatuses.name,
        color: specialStatuses.color,
      }
    })
    .from(lots)
    .innerJoin(parks, eq(lots.parkId, parks.id))
    .leftJoin(specialStatuses, eq(lots.specialStatusId, specialStatuses.id))
    .where(eq(parks.companyId, companyId))
    .orderBy(asc(parks.name), asc(lots.nameOrNumber));

    return lotsWithInfo;
  }

  async getShowingsByCompany(companyId: string, period: 'today' | 'this-week' | 'this-month'): Promise<any[]> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case 'this-week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek;
        endDate = new Date(startOfWeek);
        endDate.setDate(startOfWeek.getDate() + 7);
        break;
      case 'this-month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      default:
        startDate = new Date(0);
        endDate = new Date();
    }

    const showingsResult = await db.select({
      id: showings.id,
      startDt: showings.startDt,
      endDt: showings.endDt,
      clientName: showings.clientName,
      clientEmail: showings.clientEmail,
      clientPhone: showings.clientPhone,
      status: showings.status,
      calendarEventId: showings.calendarEventId,
      calendarHtmlLink: showings.calendarHtmlLink,
      calendarSyncError: showings.calendarSyncError,
      createdAt: showings.createdAt,
      lot: {
        id: lots.id,
        nameOrNumber: lots.nameOrNumber,
        parkId: lots.parkId,
      },
      park: {
        id: parks.id,
        name: parks.name,
        address: parks.address,
        city: parks.city,
        state: parks.state,
        zip: parks.zip,
      },
      manager: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      }
    })
    .from(showings)
    .innerJoin(lots, eq(showings.lotId, lots.id))
    .innerJoin(parks, eq(lots.parkId, parks.id))
    .innerJoin(users, eq(showings.managerId, users.id))
    .where(
      and(
        eq(parks.companyId, companyId),
        gte(showings.startDt, startDate),
        lte(showings.startDt, endDate)
      )
    )
    .orderBy(asc(showings.startDt));

    return showingsResult;
  }

  async getCompanyManagerStats(companyId: string): Promise<any> {
    // Get parks for the company
    const companyParks = await this.getParksByCompany(companyId);
    const parkIds = companyParks.parks.map(p => p.id);

    // Get lots for the company
    const companyLots = await this.getLotsByCompany(companyId);
    const activeLots = companyLots.filter(lot => lot.isActive);

    // Get showings for this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const nextMonth = new Date(thisMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthlyShowings = await db.select()
      .from(showings)
      .innerJoin(lots, eq(showings.lotId, lots.id))
      .innerJoin(parks, eq(lots.parkId, parks.id))
      .where(
        and(
          eq(parks.companyId, companyId),
          gte(showings.startDt, thisMonth),
          lte(showings.startDt, nextMonth)
        )
      );

    // Get today's showings
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const todayShowings = await db.select()
      .from(showings)
      .innerJoin(lots, eq(showings.lotId, lots.id))
      .innerJoin(parks, eq(lots.parkId, parks.id))
      .where(
        and(
          eq(parks.companyId, companyId),
          gte(showings.startDt, startOfDay),
          lte(showings.startDt, endOfDay)
        )
      );

    return {
      totalParks: companyParks.parks.length,
      activeLots: activeLots.length,
      monthlyBookings: monthlyShowings.length,
      todayBookings: todayShowings.length
    };
  }

  // Login log operations
  async createLoginLog(log: InsertLoginLog): Promise<LoginLog> {
    const [result] = await db.insert(loginLogs).values(log).returning();
    return result;
  }

  async getLoginLogs(filters?: { userId?: string; role?: string; days?: number; success?: boolean; page?: number; limit?: number }): Promise<{ logs: any[]; totalCount: number }> {
    const days = filters?.days || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const conditions = [
      gte(loginLogs.createdAt, cutoffDate)
    ];

    if (filters?.userId) {
      conditions.push(eq(loginLogs.userId, filters.userId));
    }

    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters?.success !== undefined) {
      conditions.push(eq(loginLogs.success, filters.success));
    }

    // Get total count with same conditions
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginLogs)
      .leftJoin(users, eq(loginLogs.userId, users.id))
      .where(and(...conditions));

    // Calculate pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    const offset = (page - 1) * limit;

    // Get paginated results
    const results = await db.select({
      id: loginLogs.id,
      userId: loginLogs.userId,
      email: loginLogs.email,
      success: loginLogs.success,
      ipAddress: loginLogs.ipAddress,
      locationCity: loginLogs.locationCity,
      locationRegion: loginLogs.locationRegion,
      locationCountry: loginLogs.locationCountry,
      userAgent: loginLogs.userAgent,
      createdAt: loginLogs.createdAt,
      user: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
      }
    })
    .from(loginLogs)
    .leftJoin(users, eq(loginLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(loginLogs.createdAt))
    .limit(limit)
    .offset(offset);

    return {
      logs: results,
      totalCount: Number(count)
    };
  }

  async cleanOldLoginLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    
    await db.delete(loginLogs).where(lte(loginLogs.createdAt, cutoffDate));
    console.log(`[Storage] Cleaned login logs older than 90 days (before ${cutoffDate.toISOString()})`);
  }

  // CRM Contact operations
  async getCrmContacts(companyId: string, filters?: { q?: string; parkId?: string; companyId?: string }): Promise<any[]> {
    const conditions = [eq(crmContacts.companyId, companyId)];
    
    if (filters?.q) {
      const search = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(crmContacts.firstName, search),
          ilike(crmContacts.lastName, search),
          ilike(crmContacts.email, search),
          ilike(crmContacts.phone, search)
        ) as any
      );
    }

    if (filters?.parkId) {
      conditions.push(eq(crmContacts.parkId, filters.parkId));
    }

    const results = await db.select({
      id: crmContacts.id,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      email: crmContacts.email,
      phone: crmContacts.phone,
      source: crmContacts.source,
      companyId: crmContacts.companyId,
      parkId: crmContacts.parkId,
      companyName: companies.name,
      parkName: parks.name,
      createdBy: crmContacts.createdBy,
      tags: crmContacts.tags,
      notes: crmContacts.notes,
      tenantId: crmContacts.tenantId,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
    })
      .from(crmContacts)
      .leftJoin(companies, eq(crmContacts.companyId, companies.id))
      .leftJoin(parks, eq(crmContacts.parkId, parks.id))
      .where(and(...conditions))
      .orderBy(desc(crmContacts.createdAt));

    return results;
  }

  async getAllCrmContacts(filters?: { q?: string; parkId?: string; companyId?: string }): Promise<any[]> {
    const conditions = [];
    
    if (filters?.q) {
      const search = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(crmContacts.firstName, search),
          ilike(crmContacts.lastName, search),
          ilike(crmContacts.email, search),
          ilike(crmContacts.phone, search)
        ) as any
      );
    }

    if (filters?.companyId) {
      conditions.push(eq(crmContacts.companyId, filters.companyId));
    }

    if (filters?.parkId) {
      conditions.push(eq(crmContacts.parkId, filters.parkId));
    }

    let query = db.select({
      id: crmContacts.id,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      email: crmContacts.email,
      phone: crmContacts.phone,
      source: crmContacts.source,
      companyId: crmContacts.companyId,
      parkId: crmContacts.parkId,
      companyName: companies.name,
      parkName: parks.name,
      createdBy: crmContacts.createdBy,
      tags: crmContacts.tags,
      notes: crmContacts.notes,
      tenantId: crmContacts.tenantId,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
    })
      .from(crmContacts)
      .leftJoin(companies, eq(crmContacts.companyId, companies.id))
      .leftJoin(parks, eq(crmContacts.parkId, parks.id))
      .orderBy(desc(crmContacts.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query;
    return results;
  }

  async getCrmContact(id: string): Promise<any> {
    const [contact] = await db.select({
      id: crmContacts.id,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      email: crmContacts.email,
      phone: crmContacts.phone,
      source: crmContacts.source,
      companyId: crmContacts.companyId,
      parkId: crmContacts.parkId,
      companyName: companies.name,
      parkName: parks.name,
      createdBy: crmContacts.createdBy,
      tags: crmContacts.tags,
      notes: crmContacts.notes,
      tenantId: crmContacts.tenantId,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
    })
      .from(crmContacts)
      .leftJoin(companies, eq(crmContacts.companyId, companies.id))
      .leftJoin(parks, eq(crmContacts.parkId, parks.id))
      .where(eq(crmContacts.id, id));
    return contact;
  }

  async createCrmContact(contact: InsertCrmContact): Promise<CrmContact> {
    const [result] = await db.insert(crmContacts).values(contact).returning();
    return result;
  }

  async updateCrmContact(id: string, updates: Partial<InsertCrmContact>): Promise<CrmContact> {
    const [result] = await db.update(crmContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmContacts.id, id))
      .returning();
    return result;
  }

  async deleteCrmContact(id: string): Promise<void> {
    // Delete all related records first to avoid foreign key constraint errors
    
    // 1. Delete notes for this contact
    await db.delete(crmNotes).where(
      and(
        eq(crmNotes.entityType, 'CONTACT'),
        eq(crmNotes.entityId, id)
      )
    );
    
    // 2. Delete tasks for this contact
    await db.delete(crmTasks).where(
      and(
        eq(crmTasks.entityType, 'CONTACT'),
        eq(crmTasks.entityId, id)
      )
    );
    
    // 3. Delete activities for this contact
    await db.delete(crmActivities).where(
      and(
        eq(crmActivities.entityType, 'CONTACT'),
        eq(crmActivities.entityId, id)
      )
    );
    
    // 4. Delete associations where this contact is the source
    await db.delete(crmAssociations).where(
      and(
        eq(crmAssociations.sourceType, 'CONTACT'),
        eq(crmAssociations.sourceId, id)
      )
    );
    
    // 5. Delete associations where this contact is the target
    await db.delete(crmAssociations).where(
      and(
        eq(crmAssociations.targetType, 'CONTACT'),
        eq(crmAssociations.targetId, id)
      )
    );
    
    // 6. Update deals to remove the contact reference (set to null instead of deleting deals)
    await db.update(crmDeals)
      .set({ contactId: null })
      .where(eq(crmDeals.contactId, id));
    
    // 7. Finally, delete the contact
    await db.delete(crmContacts).where(eq(crmContacts.id, id));
  }

  // CRM Deal operations
  async getCrmDeals(companyId: string, filters?: { stage?: string; assignedTo?: string; contactId?: string; parkId?: string }): Promise<any[]> {
    const conditions = [eq(crmDeals.companyId, companyId)];

    if (filters?.stage) {
      conditions.push(eq(crmDeals.stage, filters.stage as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmDeals.assignedTo, filters.assignedTo));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmDeals.contactId, filters.contactId));
    }

    if (filters?.parkId) {
      conditions.push(eq(crmContacts.parkId, filters.parkId));
    }

    const results = await db.select({
      id: crmDeals.id,
      title: crmDeals.title,
      value: crmDeals.value,
      stage: crmDeals.stage,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      contactId: crmDeals.contactId,
      lotId: crmDeals.lotId,
      assignedTo: crmDeals.assignedTo,
      companyId: crmDeals.companyId,
      companyName: companies.name,
      createdBy: crmDeals.createdBy,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      contactFirstName: crmContacts.firstName,
      contactLastName: crmContacts.lastName,
      contactEmail: crmContacts.email,
      contactCompanyName: sql<string>`contact_company.name`.as('contactCompanyName'),
      contactParkName: sql<string>`contact_park.name`.as('contactParkName'),
      lotNameOrNumber: lots.nameOrNumber,
      lotPriceForRent: lots.priceForRent,
      lotPriceForSale: lots.priceForSale,
      lotPriceRentToOwn: lots.priceRentToOwn,
      lotPriceContractForDeed: lots.priceContractForDeed,
      lotDepositForRent: lots.depositForRent,
      lotDepositForSale: lots.depositForSale,
      lotDepositRentToOwn: lots.depositRentToOwn,
      lotDepositContractForDeed: lots.depositContractForDeed,
      lotDownPaymentContractForDeed: lots.downPaymentContractForDeed,
      lotRent: lots.lotRent,
    })
      .from(crmDeals)
      .leftJoin(companies, eq(crmDeals.companyId, companies.id))
      .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
      .leftJoin(sql`companies AS contact_company`, sql`contact_company.id = ${crmContacts.companyId}`)
      .leftJoin(sql`parks AS contact_park`, sql`contact_park.id = ${crmContacts.parkId}`)
      .leftJoin(lots, eq(crmDeals.lotId, lots.id))
      .where(and(...conditions))
      .orderBy(desc(crmDeals.createdAt));

    // For deals without direct lotId, check associations
    const enrichedResults = await Promise.all(
      results.map(async (deal) => {
        // If deal already has lot data from direct lotId, return as is
        if (deal.lotNameOrNumber) {
          return deal;
        }

        // Check for lot associations
        const lotAssociations = await db.select({
          lotId: crmAssociations.targetId,
        })
          .from(crmAssociations)
          .where(
            and(
              eq(crmAssociations.sourceType, 'DEAL'),
              eq(crmAssociations.sourceId, deal.id),
              eq(crmAssociations.targetType, 'LOT')
            )
          )
          .limit(1);

        if (lotAssociations.length > 0) {
          // Fetch lot details
          const [lotDetails] = await db.select({
            nameOrNumber: lots.nameOrNumber,
            priceForRent: lots.priceForRent,
            priceForSale: lots.priceForSale,
            priceRentToOwn: lots.priceRentToOwn,
            priceContractForDeed: lots.priceContractForDeed,
            depositForRent: lots.depositForRent,
            depositForSale: lots.depositForSale,
            depositRentToOwn: lots.depositRentToOwn,
            depositContractForDeed: lots.depositContractForDeed,
            downPaymentContractForDeed: lots.downPaymentContractForDeed,
            lotRent: lots.lotRent,
          })
            .from(lots)
            .where(eq(lots.id, lotAssociations[0].lotId));

          if (lotDetails) {
            return {
              ...deal,
              lotId: lotAssociations[0].lotId,
              lotNameOrNumber: lotDetails.nameOrNumber,
              lotPriceForRent: lotDetails.priceForRent,
              lotPriceForSale: lotDetails.priceForSale,
              lotPriceRentToOwn: lotDetails.priceRentToOwn,
              lotPriceContractForDeed: lotDetails.priceContractForDeed,
              lotDepositForRent: lotDetails.depositForRent,
              lotDepositForSale: lotDetails.depositForSale,
              lotDepositRentToOwn: lotDetails.depositRentToOwn,
              lotDepositContractForDeed: lotDetails.depositContractForDeed,
              lotDownPaymentContractForDeed: lotDetails.downPaymentContractForDeed,
              lotRent: lotDetails.lotRent,
            };
          }
        }

        return deal;
      })
    );

    return enrichedResults;
  }

  async getAllCrmDeals(filters?: { stage?: string; assignedTo?: string; contactId?: string; parkId?: string; companyId?: string }): Promise<any[]> {
    const conditions = [];

    if (filters?.stage) {
      conditions.push(eq(crmDeals.stage, filters.stage as any));
    }

    if (filters?.assignedTo) {
      conditions.push(eq(crmDeals.assignedTo, filters.assignedTo));
    }

    if (filters?.contactId) {
      conditions.push(eq(crmDeals.contactId, filters.contactId));
    }

    if (filters?.companyId) {
      conditions.push(eq(crmDeals.companyId, filters.companyId));
    }

    if (filters?.parkId) {
      conditions.push(eq(crmContacts.parkId, filters.parkId));
    }

    let query = db.select({
      id: crmDeals.id,
      title: crmDeals.title,
      value: crmDeals.value,
      stage: crmDeals.stage,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      contactId: crmDeals.contactId,
      lotId: crmDeals.lotId,
      assignedTo: crmDeals.assignedTo,
      companyId: crmDeals.companyId,
      companyName: companies.name,
      createdBy: crmDeals.createdBy,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      contactFirstName: crmContacts.firstName,
      contactLastName: crmContacts.lastName,
      contactEmail: crmContacts.email,
      contactCompanyName: sql<string>`contact_company.name`.as('contactCompanyName'),
      contactParkName: sql<string>`contact_park.name`.as('contactParkName'),
      lotNameOrNumber: lots.nameOrNumber,
      lotPriceForRent: lots.priceForRent,
      lotPriceForSale: lots.priceForSale,
      lotPriceRentToOwn: lots.priceRentToOwn,
      lotPriceContractForDeed: lots.priceContractForDeed,
      lotDepositForRent: lots.depositForRent,
      lotDepositForSale: lots.depositForSale,
      lotDepositRentToOwn: lots.depositRentToOwn,
      lotDepositContractForDeed: lots.depositContractForDeed,
      lotDownPaymentContractForDeed: lots.downPaymentContractForDeed,
      lotRent: lots.lotRent,
    })
      .from(crmDeals)
      .leftJoin(companies, eq(crmDeals.companyId, companies.id))
      .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
      .leftJoin(sql`companies AS contact_company`, sql`contact_company.id = ${crmContacts.companyId}`)
      .leftJoin(sql`parks AS contact_park`, sql`contact_park.id = ${crmContacts.parkId}`)
      .leftJoin(lots, eq(crmDeals.lotId, lots.id))
      .orderBy(desc(crmDeals.createdAt));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query;

    // For deals without direct lotId, check associations
    const enrichedResults = await Promise.all(
      results.map(async (deal) => {
        // If deal already has lot data from direct lotId, return as is
        if (deal.lotNameOrNumber) {
          return deal;
        }

        // Check for lot associations
        const lotAssociations = await db.select({
          lotId: crmAssociations.targetId,
        })
          .from(crmAssociations)
          .where(
            and(
              eq(crmAssociations.sourceType, 'DEAL'),
              eq(crmAssociations.sourceId, deal.id),
              eq(crmAssociations.targetType, 'LOT')
            )
          )
          .limit(1);

        if (lotAssociations.length > 0) {
          // Fetch lot details
          const [lotDetails] = await db.select({
            nameOrNumber: lots.nameOrNumber,
            priceForRent: lots.priceForRent,
            priceForSale: lots.priceForSale,
            priceRentToOwn: lots.priceRentToOwn,
            priceContractForDeed: lots.priceContractForDeed,
            depositForRent: lots.depositForRent,
            depositForSale: lots.depositForSale,
            depositRentToOwn: lots.depositRentToOwn,
            depositContractForDeed: lots.depositContractForDeed,
            downPaymentContractForDeed: lots.downPaymentContractForDeed,
            lotRent: lots.lotRent,
          })
            .from(lots)
            .where(eq(lots.id, lotAssociations[0].lotId));

          if (lotDetails) {
            return {
              ...deal,
              lotId: lotAssociations[0].lotId,
              lotNameOrNumber: lotDetails.nameOrNumber,
              lotPriceForRent: lotDetails.priceForRent,
              lotPriceForSale: lotDetails.priceForSale,
              lotPriceRentToOwn: lotDetails.priceRentToOwn,
              lotPriceContractForDeed: lotDetails.priceContractForDeed,
              lotDepositForRent: lotDetails.depositForRent,
              lotDepositForSale: lotDetails.depositForSale,
              lotDepositRentToOwn: lotDetails.depositRentToOwn,
              lotDepositContractForDeed: lotDetails.depositContractForDeed,
              lotDownPaymentContractForDeed: lotDetails.downPaymentContractForDeed,
              lotRent: lotDetails.lotRent,
            };
          }
        }

        return deal;
      })
    );

    return enrichedResults;
  }

  async getCrmDeal(id: string): Promise<CrmDeal | undefined> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal;
  }

  async createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal> {
    const [result] = await db.insert(crmDeals).values(deal).returning();
    return result;
  }

  async updateCrmDeal(id: string, updates: Partial<InsertCrmDeal>): Promise<CrmDeal> {
    const [result] = await db.update(crmDeals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmDeals.id, id))
      .returning();
    return result;
  }

  async deleteCrmDeal(id: string): Promise<void> {
    // Delete all related records first to avoid foreign key constraint errors
    
    // 1. Delete notes for this deal
    await db.delete(crmNotes).where(
      and(
        eq(crmNotes.entityType, 'DEAL'),
        eq(crmNotes.entityId, id)
      )
    );
    
    // 2. Delete tasks for this deal
    await db.delete(crmTasks).where(
      and(
        eq(crmTasks.entityType, 'DEAL'),
        eq(crmTasks.entityId, id)
      )
    );
    
    // 3. Delete activities for this deal
    await db.delete(crmActivities).where(
      and(
        eq(crmActivities.entityType, 'DEAL'),
        eq(crmActivities.entityId, id)
      )
    );
    
    // 4. Delete associations where this deal is the source
    await db.delete(crmAssociations).where(
      and(
        eq(crmAssociations.sourceType, 'DEAL'),
        eq(crmAssociations.sourceId, id)
      )
    );
    
    // 5. Delete associations where this deal is the target
    await db.delete(crmAssociations).where(
      and(
        eq(crmAssociations.targetType, 'DEAL'),
        eq(crmAssociations.targetId, id)
      )
    );
    
    // 6. Finally, delete the deal
    await db.delete(crmDeals).where(eq(crmDeals.id, id));
  }

  // CRM Task operations
  async getCrmTasks(companyId: string, filters?: { assignedTo?: string; status?: string; entityType?: string; entityId?: string }): Promise<CrmTask[]> {
    const conditions = [eq(crmTasks.companyId, companyId)];

    if (filters?.assignedTo) {
      conditions.push(eq(crmTasks.assignedTo, filters.assignedTo));
    }

    if (filters?.status) {
      conditions.push(eq(crmTasks.status, filters.status as any));
    }

    if (filters?.entityType && filters?.entityId) {
      conditions.push(eq(crmTasks.entityType, filters.entityType as any));
      conditions.push(eq(crmTasks.entityId, filters.entityId));
    }

    const results = await db.select()
      .from(crmTasks)
      .where(and(...conditions))
      .orderBy(asc(crmTasks.dueDate));

    return results;
  }

  async getCrmTask(id: string): Promise<CrmTask | undefined> {
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, id));
    return task;
  }

  async createCrmTask(task: InsertCrmTask): Promise<CrmTask> {
    const [result] = await db.insert(crmTasks).values(task).returning();
    return result;
  }

  async updateCrmTask(id: string, updates: Partial<InsertCrmTask>): Promise<CrmTask> {
    const [result] = await db.update(crmTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmTasks.id, id))
      .returning();
    return result;
  }

  async deleteCrmTask(id: string): Promise<void> {
    await db.delete(crmTasks).where(eq(crmTasks.id, id));
  }

  // Helper function to parse user mentions from note content
  private parseUserMentions(content: string): string[] {
    // Match pattern @[userId:DisplayName]
    const mentionRegex = /@\[([^:]+):[^\]]+\]/g;
    const userIds: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      userIds.push(match[1]);
    }
    
    return [...new Set(userIds)]; // Remove duplicates
  }

  // CRM Note operations
  async getCrmNotes(entityType: string, entityId: string): Promise<any[]> {
    const results = await db.select({
      id: crmNotes.id,
      content: crmNotes.content,
      entityType: crmNotes.entityType,
      entityId: crmNotes.entityId,
      createdBy: crmNotes.createdBy,
      companyId: crmNotes.companyId,
      mentionedUsers: crmNotes.mentionedUsers,
      createdAt: crmNotes.createdAt,
      updatedAt: crmNotes.updatedAt,
      authorName: users.fullName,
      authorEmail: users.email,
    })
      .from(crmNotes)
      .leftJoin(users, eq(crmNotes.createdBy, users.id))
      .where(
        and(
          eq(crmNotes.entityType, entityType as any),
          eq(crmNotes.entityId, entityId)
        )
      )
      .orderBy(desc(crmNotes.createdAt));

    return results;
  }

  async getCrmNote(id: string): Promise<CrmNote | undefined> {
    const [note] = await db.select().from(crmNotes).where(eq(crmNotes.id, id));
    return note;
  }

  async createCrmNote(note: InsertCrmNote): Promise<CrmNote> {
    // Parse user mentions from content
    const mentionedUserIds = this.parseUserMentions(note.content);
    
    // Insert note with mentioned users
    const [result] = await db.insert(crmNotes).values({
      ...note,
      mentionedUsers: mentionedUserIds.length > 0 ? mentionedUserIds : null,
    }).returning();
    
    return result;
  }

  async updateCrmNote(id: string, updates: Partial<InsertCrmNote>): Promise<CrmNote> {
    const [result] = await db.update(crmNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(crmNotes.id, id))
      .returning();
    return result;
  }

  async deleteCrmNote(id: string): Promise<void> {
    await db.delete(crmNotes).where(eq(crmNotes.id, id));
  }

  // CRM Activity operations
  async getCrmActivities(entityType: string, entityId: string): Promise<CrmActivity[]> {
    const results = await db.select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.entityType, entityType as any),
          eq(crmActivities.entityId, entityId)
        )
      )
      .orderBy(desc(crmActivities.createdAt));

    return results;
  }

  async createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity> {
    const [result] = await db.insert(crmActivities).values(activity).returning();
    return result;
  }

  // CRM Message operations
  async getCrmMessages(userId: string, otherUserId?: string): Promise<CrmMessage[]> {
    let conditions;
    
    if (otherUserId) {
      // Get messages between two specific users
      conditions = or(
        and(
          eq(crmMessages.senderId, userId),
          eq(crmMessages.receiverId, otherUserId)
        ),
        and(
          eq(crmMessages.senderId, otherUserId),
          eq(crmMessages.receiverId, userId)
        )
      );
    } else {
      // Get all messages for user
      conditions = or(
        eq(crmMessages.senderId, userId),
        eq(crmMessages.receiverId, userId)
      );
    }

    const results = await db.select()
      .from(crmMessages)
      .where(conditions)
      .orderBy(asc(crmMessages.createdAt));

    // Decrypt message content before returning
    return results.map(msg => ({
      ...msg,
      content: decryptMessage(msg.content)
    }));
  }

  async getCrmMessage(id: string): Promise<CrmMessage | undefined> {
    const [message] = await db.select().from(crmMessages).where(eq(crmMessages.id, id));
    if (!message) return undefined;
    
    // Decrypt message content before returning
    return {
      ...message,
      content: decryptMessage(message.content)
    };
  }

  async createCrmMessage(message: InsertCrmMessage): Promise<CrmMessage> {
    // Encrypt the message content before storing
    const encryptedMessage = {
      ...message,
      content: encryptMessage(message.content)
    };
    
    const [result] = await db.insert(crmMessages).values(encryptedMessage).returning();
    
    // Decrypt content before returning to caller
    return {
      ...result,
      content: message.content // Return original plaintext to caller
    };
  }

  async markMessageAsRead(id: string): Promise<void> {
    await db.update(crmMessages)
      .set({ read: true, readAt: new Date() })
      .where(eq(crmMessages.id, id));
  }

  async markAllMessagesAsRead(userId: string): Promise<void> {
    await db.update(crmMessages)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(crmMessages.receiverId, userId),
          eq(crmMessages.read, false)
        )
      );
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crmMessages)
      .where(
        and(
          eq(crmMessages.receiverId, userId),
          eq(crmMessages.read, false)
        )
      );

    return Number(count);
  }

  async getConversations(userId: string): Promise<any[]> {
    // Get unique users who have messages with this user
    const sentMessages = await db.select({
      userId: crmMessages.receiverId,
      lastMessage: crmMessages.content,
      lastMessageAt: crmMessages.createdAt,
      read: crmMessages.read
    })
    .from(crmMessages)
    .where(eq(crmMessages.senderId, userId))
    .orderBy(desc(crmMessages.createdAt));

    const receivedMessages = await db.select({
      userId: crmMessages.senderId,
      lastMessage: crmMessages.content,
      lastMessageAt: crmMessages.createdAt,
      read: crmMessages.read
    })
    .from(crmMessages)
    .where(eq(crmMessages.receiverId, userId))
    .orderBy(desc(crmMessages.createdAt));

    // Combine and get unique users with their last message
    const conversationsMap = new Map();
    
    [...sentMessages, ...receivedMessages].forEach(msg => {
      // Decrypt the last message content
      const decryptedMsg = {
        ...msg,
        lastMessage: decryptMessage(msg.lastMessage)
      };
      
      if (!conversationsMap.has(decryptedMsg.userId) || 
          conversationsMap.get(decryptedMsg.userId).lastMessageAt < decryptedMsg.lastMessageAt) {
        conversationsMap.set(decryptedMsg.userId, decryptedMsg);
      }
    });

    return Array.from(conversationsMap.values());
  }

  async getNotifications(userId: string, companyId: string): Promise<any> {
    // Get user to check lastNotificationClearedAt
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Get assigned tasks that are TODO or IN_PROGRESS
    // Filter out tasks created before last notification cleared timestamp
    const taskConditions = [
      eq(crmTasks.assignedTo, userId),
      eq(crmTasks.companyId, companyId),
      or(
        eq(crmTasks.status, 'TODO'),
        eq(crmTasks.status, 'IN_PROGRESS')
      )
    ];

    // Only show tasks created after the last notification clear
    if (user?.lastNotificationClearedAt) {
      taskConditions.push(gt(crmTasks.createdAt, user.lastNotificationClearedAt));
    }

    const tasks = await db.select()
      .from(crmTasks)
      .where(and(...taskConditions))
      .orderBy(asc(crmTasks.dueDate))
      .limit(10);

    // Enrich tasks with entity information
    const enrichedTasks = await Promise.all(tasks.map(async (task) => {
      let entityName = null;
      
      if (task.entityType && task.entityId) {
        try {
          switch (task.entityType) {
            case 'CONTACT': {
              const [contact] = await db.select({
                firstName: crmContacts.firstName,
                lastName: crmContacts.lastName
              })
                .from(crmContacts)
                .where(eq(crmContacts.id, task.entityId))
                .limit(1);
              
              if (contact) {
                entityName = `${contact.firstName} ${contact.lastName}`;
              }
              break;
            }
            case 'DEAL': {
              const [deal] = await db.select({
                title: crmDeals.title
              })
                .from(crmDeals)
                .where(eq(crmDeals.id, task.entityId))
                .limit(1);
              
              if (deal) {
                entityName = deal.title;
              }
              break;
            }
            case 'LOT': {
              const [lot] = await db.select({
                lotNumber: lots.lotNumber,
                parkId: lots.parkId
              })
                .from(lots)
                .where(eq(lots.id, task.entityId))
                .limit(1);
              
              if (lot) {
                // Try to get park name for better context
                if (lot.parkId) {
                  const [park] = await db.select({
                    name: parks.name
                  })
                    .from(parks)
                    .where(eq(parks.id, lot.parkId))
                    .limit(1);
                  
                  if (park) {
                    entityName = `Lot ${lot.lotNumber} (${park.name})`;
                  } else {
                    entityName = `Lot ${lot.lotNumber}`;
                  }
                } else {
                  entityName = `Lot ${lot.lotNumber}`;
                }
              }
              break;
            }
          }
        } catch (error) {
          console.error('Error fetching entity for task:', error);
        }
      }

      return {
        ...task,
        entityName,
      };
    }));

    // Get unread messages with sender information
    const unreadMessages = await db.select({
      id: crmMessages.id,
      senderId: crmMessages.senderId,
      receiverId: crmMessages.receiverId,
      content: crmMessages.content,
      read: crmMessages.read,
      createdAt: crmMessages.createdAt,
      senderName: users.fullName
    })
      .from(crmMessages)
      .leftJoin(users, eq(crmMessages.senderId, users.id))
      .where(
        and(
          eq(crmMessages.receiverId, userId),
          eq(crmMessages.read, false)
        )
      )
      .orderBy(desc(crmMessages.createdAt))
      .limit(5);

    const unreadCount = await this.getUnreadMessageCount(userId);

    // Decrypt message content before returning
    const decryptedMessages = unreadMessages.map(msg => ({
      ...msg,
      content: decryptMessage(msg.content)
    }));

    // Get notes where user is mentioned
    // Filter out mentions created before last mention cleared timestamp
    const mentionConditions = [
      eq(crmNotes.companyId, companyId),
      sql`${userId} = ANY(${crmNotes.mentionedUsers})`
    ];

    // Only show mentions created after the last mention clear
    if (user?.lastMentionClearedAt) {
      mentionConditions.push(gt(crmNotes.createdAt, user.lastMentionClearedAt));
    }

    const mentions = await db.select({
      id: crmNotes.id,
      content: crmNotes.content,
      entityType: crmNotes.entityType,
      entityId: crmNotes.entityId,
      createdBy: crmNotes.createdBy,
      createdAt: crmNotes.createdAt,
      authorName: users.fullName,
    })
      .from(crmNotes)
      .leftJoin(users, eq(crmNotes.createdBy, users.id))
      .where(and(...mentionConditions))
      .orderBy(desc(crmNotes.createdAt))
      .limit(5);

    // Enrich mentions with entity information
    const enrichedMentions = await Promise.all(mentions.map(async (mention) => {
      let entityName = null;
      
      try {
        switch (mention.entityType) {
          case 'CONTACT': {
            const [contact] = await db.select({
              firstName: crmContacts.firstName,
              lastName: crmContacts.lastName
            })
              .from(crmContacts)
              .where(eq(crmContacts.id, mention.entityId))
              .limit(1);
            
            if (contact) {
              entityName = `${contact.firstName} ${contact.lastName}`;
            }
            break;
          }
          case 'DEAL': {
            const [deal] = await db.select({
              title: crmDeals.title
            })
              .from(crmDeals)
              .where(eq(crmDeals.id, mention.entityId))
              .limit(1);
            
            if (deal) {
              entityName = deal.title;
            }
            break;
          }
          case 'LOT': {
            const [lot] = await db.select({
              nameOrNumber: lots.nameOrNumber,
              parkId: lots.parkId
            })
              .from(lots)
              .where(eq(lots.id, mention.entityId))
              .limit(1);
            
            if (lot) {
              if (lot.parkId) {
                const [park] = await db.select({
                  name: parks.name
                })
                  .from(parks)
                  .where(eq(parks.id, lot.parkId))
                  .limit(1);
                
                if (park) {
                  entityName = `Lot ${lot.nameOrNumber} (${park.name})`;
                } else {
                  entityName = `Lot ${lot.nameOrNumber}`;
                }
              } else {
                entityName = `Lot ${lot.nameOrNumber}`;
              }
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error fetching entity for mention:', error);
      }

      return {
        ...mention,
        entityName,
      };
    }));

    return {
      tasks: {
        count: enrichedTasks.length,
        items: enrichedTasks
      },
      messages: {
        count: unreadCount,
        items: decryptedMessages
      },
      mentions: {
        count: enrichedMentions.length,
        items: enrichedMentions
      }
    };
  }

  async clearTaskNotifications(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastNotificationClearedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async clearMentionNotifications(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastMentionClearedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // CRM Association operations
  async getCrmAssociations(sourceType: string, sourceId: string): Promise<any[]> {
    const associations = await db.select()
      .from(crmAssociations)
      .where(
        and(
          eq(crmAssociations.sourceType, sourceType as any),
          eq(crmAssociations.sourceId, sourceId)
        )
      )
      .orderBy(desc(crmAssociations.createdAt));

    // Enrich associations with entity details
    const enrichedAssociations = await Promise.all(
      associations.map(async (assoc) => {
        let entityDetails = null;
        
        if (assoc.targetType === 'CONTACT') {
          const [contact] = await db.select({
            id: crmContacts.id,
            firstName: crmContacts.firstName,
            lastName: crmContacts.lastName,
            email: crmContacts.email,
            phone: crmContacts.phone,
          }).from(crmContacts).where(eq(crmContacts.id, assoc.targetId));
          entityDetails = contact;
        } else if (assoc.targetType === 'DEAL') {
          const [deal] = await db.select({
            id: crmDeals.id,
            title: crmDeals.title,
            value: crmDeals.value,
            stage: crmDeals.stage,
          }).from(crmDeals).where(eq(crmDeals.id, assoc.targetId));
          entityDetails = deal;
        } else if (assoc.targetType === 'LOT') {
          const [lot] = await db.select({
            id: lots.id,
            nameOrNumber: lots.nameOrNumber,
            status: lots.status,
            priceForRent: lots.priceForRent,
            priceForSale: lots.priceForSale,
            priceRentToOwn: lots.priceRentToOwn,
            priceContractForDeed: lots.priceContractForDeed,
          }).from(lots).where(eq(lots.id, assoc.targetId));
          entityDetails = lot;
        }
        
        return {
          ...assoc,
          entityDetails,
        };
      })
    );

    return enrichedAssociations;
  }

  async getCrmAssociation(id: string): Promise<CrmAssociation | undefined> {
    const [association] = await db.select()
      .from(crmAssociations)
      .where(eq(crmAssociations.id, id));
    return association;
  }

  async createCrmAssociation(association: InsertCrmAssociation): Promise<CrmAssociation> {
    try {
      console.log("Creating CRM association:", association);
      
      // Check if association already exists
      const existingAssociation = await db.select()
        .from(crmAssociations)
        .where(
          and(
            eq(crmAssociations.sourceType, association.sourceType),
            eq(crmAssociations.sourceId, association.sourceId),
            eq(crmAssociations.targetType, association.targetType),
            eq(crmAssociations.targetId, association.targetId)
          )
        )
        .limit(1);

      if (existingAssociation.length > 0) {
        console.log("Association already exists, returning existing:", existingAssociation[0]);
        return existingAssociation[0];
      }

      // Create the main association
      const [result] = await db.insert(crmAssociations).values(association).returning();
      console.log("Created main association:", result);
      
      // Create the reverse association for bidirectional linking
      const reverseAssociation = {
        sourceType: association.targetType,
        sourceId: association.targetId,
        targetType: association.sourceType,
        targetId: association.sourceId,
        relationshipType: association.relationshipType,
        companyId: association.companyId,
        createdBy: association.createdBy,
      };

      // Check if reverse association already exists
      const existingReverse = await db.select()
        .from(crmAssociations)
        .where(
          and(
            eq(crmAssociations.sourceType, reverseAssociation.sourceType),
            eq(crmAssociations.sourceId, reverseAssociation.sourceId),
            eq(crmAssociations.targetType, reverseAssociation.targetType),
            eq(crmAssociations.targetId, reverseAssociation.targetId)
          )
        )
        .limit(1);

      if (existingReverse.length === 0) {
        await db.insert(crmAssociations).values(reverseAssociation);
        console.log("Created reverse association");
      }

      return result;
    } catch (error) {
      console.error("Error in createCrmAssociation:", error);
      throw error;
    }
  }

  async deleteCrmAssociation(id: string): Promise<void> {
    // Get the association to delete
    const [association] = await db.select()
      .from(crmAssociations)
      .where(eq(crmAssociations.id, id));

    if (association) {
      // Delete the main association
      await db.delete(crmAssociations).where(eq(crmAssociations.id, id));

      // Delete the reverse association
      await db.delete(crmAssociations)
        .where(
          and(
            eq(crmAssociations.sourceType, association.targetType),
            eq(crmAssociations.sourceId, association.targetId),
            eq(crmAssociations.targetType, association.sourceType),
            eq(crmAssociations.targetId, association.sourceId)
          )
        );
    }
  }
}

export const storage = new DatabaseStorage();
