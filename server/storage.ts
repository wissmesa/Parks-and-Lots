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
  type OAuthAccount
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, or, like, desc, asc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(filters?: { role?: 'ADMIN' | 'MANAGER' }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Company operations
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: string): Promise<void>;
  
  // Park operations
  getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string }): Promise<{ parks: Park[] }>;
  getPark(id: string): Promise<Park | undefined>;
  createPark(park: InsertPark): Promise<Park>;
  updatePark(id: string, updates: Partial<InsertPark>): Promise<Park>;
  deletePark(id: string): Promise<void>;
  
  // Lot operations
  getLots(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number }): Promise<Lot[]>;
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
  
  // Manager assignments
  getManagerAssignments(userId?: string, parkId?: string): Promise<any[]>;
  assignManagerToPark(userId: string, parkId: string): Promise<void>;
  removeManagerFromPark(userId: string, parkId: string): Promise<void>;
  
  // OAuth operations
  getOAuthAccount(userId: string, provider: string): Promise<OAuthAccount | undefined>;
  createOrUpdateOAuthAccount(userId: string, data: Partial<OAuthAccount>): Promise<OAuthAccount>;
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

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(asc(companies.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
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

  async getParks(filters?: { companyId?: string; city?: string; state?: string; q?: string }): Promise<{ parks: Park[] }> {
    let query = db.select().from(parks);
    const conditions = [];

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
        or(
          sql`LOWER(${parks.name}) LIKE ${`%${searchTerm}%`}`,
          sql`LOWER(${parks.description}) LIKE ${`%${searchTerm}%`}`,
          sql`LOWER(${parks.address}) LIKE ${`%${searchTerm}%`}`
        )
      );
    }

    if (conditions.length > 0) {
      const parksResult = await query.where(and(...conditions)).orderBy(asc(parks.name));
      return { parks: parksResult };
    }

    const parksResult = await query.orderBy(asc(parks.name));
    return { parks: parksResult };
  }

  async getPark(id: string): Promise<Park | undefined> {
    const [park] = await db.select().from(parks).where(eq(parks.id, id));
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

  async getLots(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number }): Promise<Lot[]> {
    let query = db.select().from(lots);
    const conditions = [eq(lots.isActive, true)];

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

    return await query.where(and(...conditions)).orderBy(asc(lots.nameOrNumber));
  }

  async getLotsWithParkInfo(filters?: { parkId?: string; status?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; bathrooms?: number; state?: string; q?: string }): Promise<any[]> {
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
      .innerJoin(parks, eq(lots.parkId, parks.id));
    
    const conditions = [eq(lots.isActive, true)];

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
      const nameSearch = sql`LOWER(${lots.nameOrNumber}) LIKE '%${searchTerm}%'`;
      const descSearch = sql`LOWER(${lots.description}) LIKE '%${searchTerm}%'`;
      const parkSearch = sql`LOWER(${parks.name}) LIKE '%${searchTerm}%'`;
      conditions.push(or(nameSearch, descSearch, parkSearch));
    }

    return await query.where(and(...conditions)).orderBy(asc(lots.nameOrNumber));
  }

  async getLot(id: string): Promise<Lot | undefined> {
    const [lot] = await db.select().from(lots).where(eq(lots.id, id));
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

  async getShowings(filters?: { lotId?: string; managerId?: string; status?: string }): Promise<Showing[]> {
    let query = db.select().from(showings);
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
      return await query.where(and(...conditions)).orderBy(desc(showings.startDt));
    }

    return await query.orderBy(desc(showings.startDt));
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
    const [newInvite] = await db.insert(invites).values([invite]).returning();
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
}

export const storage = new DatabaseStorage();
