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
  type OAuthAccount
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, or, like, ilike, desc, asc, sql, inArray, isNotNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(filters?: { role?: 'ADMIN' | 'MANAGER' }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Company operations
  getCompanies(includeInactive?: boolean): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Park operations
  getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string; includeInactive?: boolean }): Promise<{ parks: Park[] }>;
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
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
  
  // Invite operations
  getInvites(): Promise<Invite[]>;
  getInviteByToken(token: string): Promise<Invite | undefined>;
  createInvite(invite: InsertInvite): Promise<Invite>;
  acceptInvite(token: string): Promise<Invite>;
  deleteInvite(id: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getAllManagerAssignments(): Promise<any[]>;
  removeManagerAssignments(userId: string): Promise<void>;
  
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
  
  // Google Calendar token operations
  getGoogleCalendarToken(userId: string): Promise<GoogleCalendarToken | undefined>;
  createOrUpdateGoogleCalendarToken(userId: string, token: InsertGoogleCalendarToken): Promise<GoogleCalendarToken>;
  deleteGoogleCalendarToken(userId: string): Promise<void>;
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

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getUsers(filters?: { role?: 'ADMIN' | 'MANAGER' }): Promise<User[]> {
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
    const [company] = await db.update(companies).set(updates).where(eq(companies.id, id)).returning();
    return company;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string; includeInactive?: boolean }): Promise<{ parks: Park[] }> {
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

    const results = await query
      .where(and(...conditions))
      .orderBy(asc(parks.name));
    
    // Extract only park data from the joined result
    const parksResult = results.map(row => ({
      id: row.parks.id,
      companyId: row.parks.companyId,
      name: row.parks.name,
      address: row.parks.address,
      city: row.parks.city,
      state: row.parks.state,
      zip: row.parks.zip,
      description: row.parks.description,
      amenities: row.parks.amenities,
      isActive: row.parks.isActive,
      createdAt: row.parks.createdAt
    }));
    
    return { parks: parksResult };
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
    const [park] = await db.update(parks).set(updates).where(eq(parks.id, id)).returning();
    return park;
  }

  async deletePark(id: string): Promise<void> {
    await db.delete(parks).where(eq(parks.id, id));
  }

  async getLots(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; includeInactive?: boolean }): Promise<Lot[]> {
    let query = db.select().from(lots)
      .innerJoin(parks, eq(lots.parkId, parks.id))
      .innerJoin(companies, eq(parks.companyId, companies.id));
    
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
      conditions.push(eq(lots.status, filters.status as any));
    }
    if (filters?.minPrice) {
      conditions.push(gte(lots.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(lots.price, filters.maxPrice.toString()));
    }
    if (filters?.bedrooms) {
      conditions.push(eq(lots.bedrooms, filters.bedrooms));
    }
    if (filters?.bathrooms) {
      conditions.push(eq(lots.bathrooms, filters.bathrooms));
    }

    const results = await query.where(and(...conditions)).orderBy(asc(lots.nameOrNumber));
    
    // Extract only lot data from the joined result
    return results.map(row => row.lots);
  }

  async getLotsWithParkInfo(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; state?: string; q?: string; includeInactive?: boolean }): Promise<any[]> {
    let query = db.select({
      id: lots.id,
      nameOrNumber: lots.nameOrNumber,
      status: lots.status,
      price: lots.price,
      description: lots.description,
      bedrooms: lots.bedrooms,
      bathrooms: lots.bathrooms,
      sqFt: lots.sqFt,
      isActive: lots.isActive,
      parkId: lots.parkId,
      park: {
        id: parks.id,
        name: parks.name,
        city: parks.city,
        state: parks.state
      }
    }).from(lots)
      .innerJoin(parks, eq(lots.parkId, parks.id))
      .innerJoin(companies, eq(parks.companyId, companies.id));
    
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
      conditions.push(eq(lots.status, filters.status as any));
    }
    if (filters?.minPrice) {
      conditions.push(gte(lots.price, filters.minPrice.toString()));
    }
    if (filters?.maxPrice) {
      conditions.push(lte(lots.price, filters.maxPrice.toString()));
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

    return await query.where(and(...conditions)).orderBy(asc(lots.nameOrNumber));
  }

  async getLot(id: string): Promise<Lot | undefined> {
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
    const [lot] = await db.update(lots).set(updates).where(eq(lots.id, id)).returning();
    return lot;
  }

  async deleteLot(id: string): Promise<void> {
    await db.delete(lots).where(eq(lots.id, id));
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
      lotId: lots.id,
      lotNameOrNumber: lots.nameOrNumber,
      parkId: parks.id,
      parkName: parks.name,
    }).from(showings)
      .leftJoin(lots, eq(showings.lotId, lots.id))
      .leftJoin(parks, eq(lots.parkId, parks.id));
      
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
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        clientPhone: row.clientPhone,
        createdAt: row.createdAt,
        lot: {
          id: row.lotId,
          nameOrNumber: row.lotNameOrNumber,
          park: {
            id: row.parkId,
            name: row.parkName,
          },
        },
      }));
    }

    const results = await query.orderBy(desc(showings.startDt));
    return results.map(row => ({
      id: row.id,
      startDt: row.startDt,
      endDt: row.endDt,
      status: row.status,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      clientPhone: row.clientPhone,
      createdAt: row.createdAt,
      lot: {
        id: row.lotId,
        nameOrNumber: row.lotNameOrNumber,
        park: {
          id: row.parkId,
          name: row.parkName,
        },
      },
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
    const conditions = [
      eq(showings.lotId, lotId),
      or(
        and(gte(showings.startDt, startDt), lte(showings.startDt, endDt)),
        and(gte(showings.endDt, startDt), lte(showings.endDt, endDt)),
        and(lte(showings.startDt, startDt), gte(showings.endDt, endDt))
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

  async createPhoto(photo: InsertPhoto): Promise<Photo> {
    const [newPhoto] = await db.insert(photos).values(photo).returning();
    return newPhoto;
  }

  async deletePhoto(id: string): Promise<void> {
    await db.delete(photos).where(eq(photos.id, id));
  }

  async getInvites(): Promise<Invite[]> {
    return await db.select().from(invites).orderBy(desc(invites.createdAt));
  }

  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    return invite;
  }

  async createInvite(invite: InsertInvite & { token?: string }): Promise<Invite> {
    const inviteData = {
      ...invite,
      token: invite.token || '', // Ensure token is provided
    };
    const [newInvite] = await db.insert(invites).values(inviteData).returning();
    return newInvite;
  }

  async acceptInvite(token: string): Promise<Invite> {
    const [invite] = await db.update(invites)
      .set({ acceptedAt: new Date() })
      .where(eq(invites.token, token))
      .returning();
    return invite;
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
      return await query.where(and(...conditions));
    }

    return await query;
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
    // First remove any manager assignments
    await this.removeManagerAssignments(id);
    // Then delete the user
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
}

export const storage = new DatabaseStorage();
