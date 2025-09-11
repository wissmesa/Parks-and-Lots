import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import multer from "multer";
import { storage } from "./storage";
import { 
  authenticateToken, 
  requireRole, 
  requireParkAccess, 
  requireLotAccess, 
  generateTokens, 
  hashPassword, 
  comparePassword,
  type AuthRequest 
} from "./auth";
import { calendarService } from "./calendar";
import { googleCalendarService } from "./google-calendar";
import { 
  insertUserSchema,
  insertCompanySchema, 
  insertParkSchema, 
  insertLotSchema, 
  insertShowingSchema,
  insertAvailabilitySchema,
  insertPhotoSchema,
  insertInviteSchema,
  bookingSchema
} from "@shared/schema";
import { randomBytes } from "crypto";

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'static/uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files
  app.use('/static', express.static(path.join(process.cwd(), 'static')));

  // Health check
  app.get('/api/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Admin Stats Endpoint
  app.get('/api/admin/stats', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const totalParks = await storage.getParks();
      const allLots = await storage.getLots();
      const activeLots = allLots.filter(lot => lot.isActive);
      const allShowings = await storage.getShowings();
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const monthlyBookings = allShowings.filter(showing => 
        new Date(showing.startDt) >= thisMonth
      );
      
      const managers = await storage.getUsers({ role: 'MANAGER' });
      
      res.json({
        totalParks: totalParks.parks?.length || 0,
        activeLots: activeLots.length,
        monthlyBookings: monthlyBookings.length,
        activeManagers: managers.length
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Recent Bookings Endpoint
  app.get('/api/admin/recent-bookings', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const showings = await storage.getShowings();
      const recentBookings = showings
        .slice(0, 10)
        .map(showing => ({
          ...showing,
          lotName: showing.lotId
        }));
      
      res.json(recentBookings);
    } catch (error) {
      console.error('Recent bookings error:', error);
      res.status(500).json({ message: 'Failed to fetch recent bookings' });
    }
  });

  // Managers List Endpoint
  app.get('/api/admin/managers', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const managers = await storage.getUsers({ role: 'MANAGER' });
      res.json(managers);
    } catch (error) {
      console.error('Managers list error:', error);
      res.status(500).json({ message: 'Failed to fetch managers' });
    }
  });

  // Manager API Endpoints
  app.get('/api/manager/assignments', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getManagerAssignments(req.user!.id);
      res.json(assignments);
    } catch (error) {
      console.error('Manager assignments error:', error);
      res.status(500).json({ message: 'Failed to fetch assignments' });
    }
  });

  app.get('/api/manager/showings/today', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      const showings = await storage.getShowings({ managerId: req.user!.id });
      const todayShowings = showings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfDay && showingDate < endOfDay;
      });

      res.json(todayShowings);
    } catch (error) {
      console.error('Today showings error:', error);
      res.status(500).json({ message: 'Failed to fetch today showings' });
    }
  });

  app.get('/api/manager/stats', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      let availableLots = 0;
      for (const parkId of parkIds) {
        const lots = await storage.getLots({ parkId });
        availableLots += lots.filter(lot => lot.status === 'FOR_RENT' || lot.status === 'FOR_SALE').length;
      }

      const showings = await storage.getShowings({ managerId: req.user!.id });
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const todayShowings = showings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfDay && showingDate < endOfDay;
      });

      const pendingRequests = showings.filter(showing => showing.status === 'SCHEDULED').length;

      res.json({
        todayShowings: todayShowings.length,
        availableLots,
        pendingRequests
      });
    } catch (error) {
      console.error('Manager stats error:', error);
      res.status(500).json({ message: 'Failed to fetch manager stats' });
    }
  });

  // Manager Lots CRUD Endpoints
  app.get('/api/manager/lots', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      let allLots = [];
      for (const parkId of parkIds) {
        const lots = await storage.getLotsWithParkInfo({ parkId });
        allLots.push(...lots);
      }
      
      res.json(allLots);
    } catch (error) {
      console.error('Manager lots error:', error);
      res.status(500).json({ message: 'Failed to fetch lots' });
    }
  });

  app.post('/api/manager/lots', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      // Verify manager has access to the park
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      if (!parkIds.includes(req.body.parkId)) {
        return res.status(403).json({ message: 'You can only create lots in your assigned parks' });
      }
      
      const lotData = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(lotData);
      res.status(201).json(lot);
    } catch (error) {
      console.error('Create lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.patch('/api/manager/lots/:id', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      // Verify manager owns the lot (through park assignment)
      const lot = await storage.getLot(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      if (!parkIds.includes(lot.parkId)) {
        return res.status(403).json({ message: 'You can only edit lots in your assigned parks' });
      }
      
      const updates = insertLotSchema.partial().parse(req.body);
      const updatedLot = await storage.updateLot(req.params.id, updates);
      res.json(updatedLot);
    } catch (error) {
      console.error('Update lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.delete('/api/manager/lots/:id', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      // Verify manager owns the lot (through park assignment)
      const lot = await storage.getLot(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      if (!parkIds.includes(lot.parkId)) {
        return res.status(403).json({ message: 'You can only delete lots in your assigned parks' });
      }
      
      await storage.deleteLot(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete lot error:', error);
      res.status(500).json({ message: 'Failed to delete lot' });
    }
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const tokens = generateTokens(user);
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName, 
          role: user.role 
        },
        ...tokens
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/refresh', (req, res) => {
    // TODO: Implement refresh token logic
    res.status(501).json({ message: 'Not implemented' });
  });

  app.post('/api/auth/logout', (req, res) => {
    // For JWT, logout is handled client-side by removing tokens
    res.json({ message: 'Logged out successfully' });
  });

  // Google Calendar OAuth routes
  app.get('/api/auth/google/connect', authenticateToken, requireRole('MANAGER'), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      const state = `${user.id}:${randomBytes(16).toString('hex')}`;
      const authUrl = googleCalendarService.generateAuthUrl(state);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Google Calendar auth URL generation error:', error);
      res.status(500).json({ message: 'Failed to generate authorization URL' });
    }
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send('Missing authorization code or state');
      }

      // Extract and validate user ID from state
      const stateStr = state as string;
      const [stateUserId, stateNonce] = stateStr.split(':');
      
      if (!stateUserId || !stateNonce) {
        return res.status(400).send('Invalid state parameter format');
      }
      
      // Validate that the user exists and is a manager
      const user = await storage.getUser(stateUserId);
      if (!user || user.role !== 'MANAGER') {
        return res.status(403).send('Invalid user or insufficient permissions');
      }

      // Exchange code for tokens
      const tokens = await googleCalendarService.exchangeCodeForTokens(code as string);
      
      // Store tokens for the user from state
      await googleCalendarService.storeTokens(stateUserId, tokens);
      
      // Return success page that closes the popup
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Calendar Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; background: #f8f9fa; }
            .success { color: #059669; font-size: 18px; margin-bottom: 20px; }
            .message { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="success">✅ Google Calendar Connected Successfully!</div>
          <div class="message">You can close this window now.</div>
          <script>
            // Notify parent window that connection was successful
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED', success: true }, '*');
            }
            // Auto-close after 2 seconds
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Google Calendar OAuth callback error:', error);
      
      // Return error page that closes the popup
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Connection Error</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; background: #f8f9fa; }
            .error { color: #dc2626; font-size: 18px; margin-bottom: 20px; }
            .message { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="error">❌ Connection Failed</div>
          <div class="message">Please try again or close this window.</div>
          <script>
            // Notify parent window that connection failed
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED', success: false }, '*');
            }
            // Auto-close after 3 seconds
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
  });

  app.get('/api/auth/google/status', authenticateToken, requireRole('MANAGER'), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      const isConnected = await googleCalendarService.isCalendarConnected(user.id);
      res.json({ connected: isConnected });
    } catch (error) {
      console.error('Google Calendar status check error:', error);
      res.status(500).json({ message: 'Failed to check calendar connection status' });
    }
  });

  app.post('/api/auth/google/disconnect', authenticateToken, requireRole('MANAGER'), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      await googleCalendarService.disconnectCalendar(user.id);
      res.json({ message: 'Calendar disconnected successfully' });
    } catch (error) {
      console.error('Google Calendar disconnect error:', error);
      res.status(500).json({ message: 'Failed to disconnect calendar' });
    }
  });

  // Get manager availability for a specific lot (used for availability checking)
  // Public endpoint that only returns busy time ranges without personal details
  app.get('/api/lots/:id/manager-availability', async (req, res) => {
    try {
      const lotId = req.params.id;
      
      const lot = await storage.getLot(lotId);
      if (!lot) {
        console.log(`[Manager Availability] Lot not found: ${lotId}`);
        return res.status(404).json({ message: 'Lot not found' });
      }

      console.log(`[Manager Availability] Checking lot ${lotId} in park ${lot.parkId}`);

      // Get assigned manager
      const assignments = await storage.getManagerAssignments(undefined, lot.parkId);
      console.log(`[Manager Availability] Found ${assignments.length} manager assignments for park ${lot.parkId}`);
      
      if (assignments.length === 0) {
        console.log(`[Manager Availability] No managers assigned to park ${lot.parkId}`);
        return res.json({ busySlots: [], managerConnected: false });
      }
      
      const managerId = assignments[0].userId;
      console.log(`[Manager Availability] Using manager ${managerId} for lot ${lotId}`);
      
      // Check if manager has calendar connected
      const isConnected = await googleCalendarService.isCalendarConnected(managerId);
      console.log(`[Manager Availability] Manager ${managerId} calendar connected: ${isConnected}`);
      
      if (!isConnected) {
        return res.json({ busySlots: [], managerConnected: false });
      }

      // Get calendar events for the next 7 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);

      console.log(`[Manager Availability] Fetching busy slots for manager ${managerId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Use the new FreeBusy API method
      const busySlots = await googleCalendarService.getManagerBusySlots(managerId, startDate, endDate);
      
      console.log(`[Manager Availability] Found ${busySlots.length} busy slots for manager ${managerId}:`, busySlots);
      
      res.json({ 
        busySlots,
        managerConnected: true 
      });
    } catch (error) {
      console.error(`[Manager Availability] Error for lot ${req.params.id}:`, error);
      res.status(500).json({ message: 'Failed to fetch manager availability' });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res) => {
    res.json({
      id: req.user!.id,
      email: req.user!.email,
      fullName: req.user!.fullName,
      role: req.user!.role
    });
  });

  // Invite routes
  app.post('/api/auth/invites', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      const parsed = insertInviteSchema.parse({
        ...req.body,
        createdByUserId: req.user!.id
      });

      // Generate secure token
      const token = randomBytes(32).toString('hex');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await storage.createInvite({
        ...parsed,
        expiresAt
      });

      res.status(201).json({ 
        ...invite,
        inviteUrl: `${req.protocol}://${req.get('host')}/accept-invite?token=${token}`
      });
    } catch (error) {
      console.error('Create invite error:', error);
      res.status(400).json({ message: 'Invalid invite data' });
    }
  });

  app.post('/api/auth/accept-invite', async (req, res) => {
    try {
      const { token, password, fullName } = req.body;
      
      if (!token || !password || !fullName) {
        return res.status(400).json({ message: 'Token, password and full name required' });
      }

      const invite = await storage.getInviteByToken(token);
      if (!invite) {
        return res.status(404).json({ message: 'Invalid invite token' });
      }

      if (invite.acceptedAt) {
        return res.status(409).json({ message: 'Invite already accepted' });
      }

      if (invite.expiresAt < new Date()) {
        return res.status(410).json({ message: 'Invite has expired' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invite.email);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Create user
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        email: invite.email,
        passwordHash,
        fullName,
        role: invite.role,
        isActive: true
      });

      // Mark invite as accepted
      await storage.acceptInvite(token);

      const tokens = generateTokens(user);
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName, 
          role: user.role 
        },
        ...tokens
      });
    } catch (error) {
      console.error('Accept invite error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company routes
  app.get('/api/companies', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const parsed = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(parsed);
      res.status(201).json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(400).json({ message: 'Invalid company data' });
    }
  });

  app.get('/api/companies/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      res.json(company);
    } catch (error) {
      console.error('Get company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/companies/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const updates = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(req.params.id, updates);
      res.json(company);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(400).json({ message: 'Invalid company data' });
    }
  });

  app.delete('/api/companies/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.deleteCompany(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company photos
  app.get('/api/companies/:id/photos', async (req, res) => {
    try {
      const photos = await storage.getPhotos('COMPANY', req.params.id);
      res.json(photos);
    } catch (error) {
      console.error('Get company photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies/:id/photos', authenticateToken, requireRole('ADMIN'), upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('COMPANY', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const photo = await storage.createPhoto({
          entityType: 'COMPANY',
          entityId: req.params.id,
          urlOrPath: `/static/uploads/${file.filename}`,
          caption: Array.isArray(req.body.captions) ? req.body.captions[i] || '' : req.body.caption || '',
          sortOrder: currentPhotoCount + i
        });
        photos.push(photo);
      }

      res.status(201).json(allFiles.length === 1 ? photos[0] : photos);
    } catch (error) {
      console.error('Upload company photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Park routes (public and protected)
  app.get('/api/parks', async (req, res) => {
    try {
      const { companyId, city, state, q, page = '1', limit = '20' } = req.query;
      const filters = {
        companyId: companyId as string,
        city: city as string,
        state: state as string,
        q: q as string
      };

      const result = await storage.getParks(filters);
      const parksArray = result.parks;
      
      // Add pagination logic here if needed
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      
      res.json({
        parks: parksArray.slice(startIndex, endIndex),
        totalCount: parksArray.length,
        page: pageNum,
        limit: limitNum
      });
    } catch (error) {
      console.error('Get parks error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/parks/:id', async (req, res) => {
    try {
      const park = await storage.getPark(req.params.id);
      if (!park) {
        return res.status(404).json({ message: 'Park not found' });
      }
      res.json(park);
    } catch (error) {
      console.error('Get park error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/parks', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const parsed = insertParkSchema.parse(req.body);
      const park = await storage.createPark(parsed);
      res.status(201).json(park);
    } catch (error) {
      console.error('Create park error:', error);
      res.status(400).json({ message: 'Invalid park data' });
    }
  });

  app.patch('/api/parks/:id', authenticateToken, requireParkAccess, async (req, res) => {
    try {
      const updates = insertParkSchema.partial().parse(req.body);
      const park = await storage.updatePark(req.params.id, updates);
      res.json(park);
    } catch (error) {
      console.error('Update park error:', error);
      res.status(400).json({ message: 'Invalid park data' });
    }
  });

  app.delete('/api/parks/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.deletePark(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete park error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Park photos
  app.get('/api/parks/:id/photos', async (req, res) => {
    try {
      const photos = await storage.getPhotos('PARK', req.params.id);
      res.json(photos);
    } catch (error) {
      console.error('Get park photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/parks/:id/photos', authenticateToken, requireParkAccess, upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('PARK', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const photo = await storage.createPhoto({
          entityType: 'PARK',
          entityId: req.params.id,
          urlOrPath: `/static/uploads/${file.filename}`,
          caption: Array.isArray(req.body.captions) ? req.body.captions[i] || '' : req.body.caption || '',
          sortOrder: currentPhotoCount + i
        });
        photos.push(photo);
      }

      res.status(201).json(allFiles.length === 1 ? photos[0] : photos);
    } catch (error) {
      console.error('Upload park photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Manager assignments
  app.post('/api/parks/:parkId/managers/:userId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.assignManagerToPark(req.params.userId, req.params.parkId);
      res.status(204).send();
    } catch (error) {
      console.error('Assign manager error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Lot routes
  app.get('/api/lots', async (req, res) => {
    try {
      const { parkId, status, minPrice, maxPrice, bedrooms, bathrooms, state, q, price, page = '1', limit = '20' } = req.query;
      
      // Handle price range parameter (e.g. "100000-200000", "300000+", "0-100000")
      let parsedMinPrice, parsedMaxPrice;
      if (price && price !== 'all') {
        const priceStr = price as string;
        if (priceStr.includes('-')) {
          const [min, max] = priceStr.split('-').map(p => parseFloat(p));
          parsedMinPrice = min;
          parsedMaxPrice = max;
        } else if (priceStr.endsWith('+')) {
          parsedMinPrice = parseFloat(priceStr.replace('+', ''));
        }
      }
      
      const filters = {
        parkId: parkId as string,
        status: status as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : parsedMinPrice,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : parsedMaxPrice,
        bedrooms: bedrooms ? parseInt(bedrooms as string) : undefined,
        bathrooms: bathrooms ? parseInt(bathrooms as string) : undefined,
        state: state as string,
        q: q as string
      };

      const lots = await storage.getLotsWithParkInfo(filters);
      
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      
      res.json({
        lots: lots.slice(startIndex, endIndex),
        totalCount: lots.length,
        page: pageNum,
        limit: limitNum
      });
    } catch (error) {
      console.error('Get lots error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/lots/:id', async (req, res) => {
    try {
      const lot = await storage.getLot(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      res.json(lot);
    } catch (error) {
      console.error('Get lot error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/lots', authenticateToken, requireLotAccess, async (req, res) => {
    try {
      const parsed = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(parsed);
      res.status(201).json(lot);
    } catch (error) {
      console.error('Create lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.patch('/api/lots/:id', authenticateToken, requireLotAccess, async (req, res) => {
    try {
      const updates = insertLotSchema.partial().parse(req.body);
      const lot = await storage.updateLot(req.params.id, updates);
      res.json(lot);
    } catch (error) {
      console.error('Update lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.delete('/api/lots/:id', authenticateToken, requireLotAccess, async (req, res) => {
    try {
      await storage.deleteLot(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete lot error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Lot photos
  app.get('/api/lots/:id/photos', async (req, res) => {
    try {
      const photos = await storage.getPhotos('LOT', req.params.id);
      res.json(photos);
    } catch (error) {
      console.error('Get lot photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/lots/:id/photos', authenticateToken, requireLotAccess, upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('LOT', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        const photo = await storage.createPhoto({
          entityType: 'LOT',
          entityId: req.params.id,
          urlOrPath: `/static/uploads/${file.filename}`,
          caption: Array.isArray(req.body.captions) ? req.body.captions[i] || '' : req.body.caption || '',
          sortOrder: currentPhotoCount + i
        });
        photos.push(photo);
      }

      res.status(201).json(allFiles.length === 1 ? photos[0] : photos);
    } catch (error) {
      console.error('Upload lot photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Availability routes
  app.get('/api/lots/:id/availability', async (req, res) => {
    try {
      const availability = await storage.getAvailability(req.params.id);
      res.json(availability);
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/lots/:id/availability', authenticateToken, requireLotAccess, async (req, res) => {
    try {
      const parsed = insertAvailabilitySchema.parse({
        ...req.body,
        lotId: req.params.id
      });
      const availability = await storage.createAvailability(parsed);
      res.status(201).json(availability);
    } catch (error) {
      console.error('Create availability error:', error);
      res.status(400).json({ message: 'Invalid availability data' });
    }
  });

  app.delete('/api/availability/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.deleteAvailability(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete availability error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Showing routes
  app.get('/api/lots/:id/showings', async (req, res) => {
    try {
      const showings = await storage.getShowings({ lotId: req.params.id });
      
      // Remove PII from public showings - only return time/status info needed for availability display
      const publicShowings = showings.map(showing => ({
        id: showing.id,
        startDt: showing.startDt,
        endDt: showing.endDt,
        status: showing.status
      }));
      
      res.json(publicShowings);
    } catch (error) {
      console.error('Get showings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Public booking endpoint
  app.post('/api/lots/:id/book', async (req, res) => {
    try {
      const lotId = req.params.id;
      const bookingData = bookingSchema.parse(req.body);
      
      const lot = await storage.getLot(lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }

      // Get assigned manager
      const assignments = await storage.getManagerAssignments(undefined, lot.parkId);
      if (assignments.length === 0) {
        return res.status(400).json({ message: 'No manager assigned to this park' });
      }
      
      const managerId = assignments[0].userId;
      const startDt = new Date(bookingData.startDt);
      const endDt = new Date(bookingData.endDt);

      // Check for overlaps with existing showings
      const hasOverlap = await storage.checkShowingOverlap(lotId, startDt, endDt);
      if (hasOverlap) {
        return res.status(409).json({ message: 'Time slot is not available due to existing booking' });
      }

      // Check for manager's Google Calendar conflicts
      try {
        if (await googleCalendarService.isCalendarConnected(managerId)) {
          const hasCalendarConflict = await googleCalendarService.checkCalendarConflicts(managerId, startDt, endDt);
          if (hasCalendarConflict) {
            return res.status(409).json({ message: 'Time slot is not available - manager has a calendar conflict' });
          }
        }
      } catch (error) {
        console.error('Error checking calendar conflicts:', error);
        // Continue with booking if calendar check fails
      }

      // Create showing
      const showing = await storage.createShowing({
        lotId,
        managerId,
        startDt,
        endDt,
        clientName: bookingData.clientName,
        clientEmail: bookingData.clientEmail,
        clientPhone: bookingData.clientPhone,
        status: 'SCHEDULED'
      });

      // Try to sync with Google Calendar
      let calendarEventId: string | null = null;
      let calendarHtmlLink: string | null = null;
      let calendarSyncError = false;

      try {
        // Check if manager has Google Calendar connected
        if (await googleCalendarService.isCalendarConnected(managerId)) {
          const event = {
            summary: `Property Showing - ${bookingData.clientName}`,
            description: `Property showing for lot ${lot.id}\n\nClient: ${bookingData.clientName}\nEmail: ${bookingData.clientEmail}\nPhone: ${bookingData.clientPhone || 'N/A'}`,
            start: {
              dateTime: startDt.toISOString(),
              timeZone: 'UTC',
            },
            end: {
              dateTime: endDt.toISOString(),
              timeZone: 'UTC',
            },
            attendees: [
              { email: bookingData.clientEmail, displayName: bookingData.clientName }
            ]
          };

          const calendarEvent = await googleCalendarService.createCalendarEvent(managerId, event);
          calendarEventId = calendarEvent.id || null;
          calendarHtmlLink = calendarEvent.htmlLink || null;
          
          console.log(`Calendar event created: ${calendarEventId}`);
          
          // Update the showing record with calendar information
          if (calendarEventId) {
            await storage.updateShowing(showing.id, {
              calendarEventId,
              calendarHtmlLink,
              calendarSyncError: false
            } as any);
          }
        }
      } catch (error) {
        console.error('Calendar sync error:', error);
        calendarSyncError = true;
        
        // Update showing with sync error
        await storage.updateShowing(showing.id, {
          calendarSyncError: true
        } as any);
      }

      // Fetch the updated showing with calendar information
      const updatedShowing = await storage.getShowing(showing.id) || showing;

      res.status(201).json(updatedShowing);
    } catch (error) {
      console.error('Book showing error:', error);
      res.status(400).json({ message: 'Invalid booking data' });
    }
  });

  app.patch('/api/showings/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const showing = await storage.getShowing(req.params.id);
      if (!showing) {
        return res.status(404).json({ message: 'Showing not found' });
      }

      const updates = insertShowingSchema.partial().parse(req.body);
      const updatedShowing = await storage.updateShowing(req.params.id, updates);

      // Sync calendar changes
      if (updates.status || updates.startDt || updates.endDt) {
        try {
          if (updates.status === 'CANCELED' && updatedShowing.calendarEventId) {
            await googleCalendarService.deleteCalendarEvent(updatedShowing.managerId, updatedShowing.calendarEventId);
          } else if (updatedShowing.calendarEventId) {
            const event = {
              summary: `Property Showing - ${updatedShowing.clientName}`,
              description: `Property showing for lot ${updatedShowing.lotId}\n\nClient: ${updatedShowing.clientName}\nEmail: ${updatedShowing.clientEmail}\nPhone: ${updatedShowing.clientPhone}`,
              start: {
                dateTime: updatedShowing.startDt.toISOString(),
                timeZone: 'UTC',
              },
              end: {
                dateTime: updatedShowing.endDt.toISOString(),
                timeZone: 'UTC',
              },
              status: updatedShowing.status === 'CANCELED' ? 'cancelled' : 'confirmed'
            };
            await googleCalendarService.updateCalendarEvent(updatedShowing.managerId, updatedShowing.calendarEventId, event);
          }
          
          console.log('Calendar sync successful for showing update');
        } catch (error) {
          console.error('Calendar sync error:', error);
          // Update showing with sync error
          await storage.updateShowing(req.params.id, { calendarSyncError: true } as any);
        }
      }

      res.json(updatedShowing);
    } catch (error) {
      console.error('Update showing error:', error);
      res.status(400).json({ message: 'Invalid showing data' });
    }
  });

  // Google Calendar OAuth routes
  app.get('/api/oauth/google/start', authenticateToken, (req: AuthRequest, res) => {
    try {
      const authUrl = calendarService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error('OAuth start error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/oauth/google/callback', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: 'Authorization code required' });
      }

      const account = await calendarService.handleCallback(code as string, req.user!.id);
      res.json({ message: 'Calendar connected successfully', account });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ message: 'Failed to connect calendar' });
    }
  });

  // Additional admin endpoints
  
  // Get all bookings for admin
  app.get('/api/admin/bookings', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const { status } = req.query;
      const showings = await storage.getShowings();
      
      let filteredShowings = showings;
      if (status && status !== 'all') {
        filteredShowings = showings.filter(showing => showing.status === status);
      }
      
      res.json({ bookings: filteredShowings });
    } catch (error) {
      console.error('Admin bookings error:', error);
      res.status(500).json({ message: 'Failed to fetch bookings' });
    }
  });

  // Update booking status
  app.put('/api/admin/bookings/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const { status } = req.body;
      const showing = await storage.updateShowing(req.params.id, { status });
      res.json(showing);
    } catch (error) {
      console.error('Update booking status error:', error);
      res.status(500).json({ message: 'Failed to update booking status' });
    }
  });

  // Get manager assignments for admin
  app.get('/api/admin/manager-assignments', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const assignments = await storage.getAllManagerAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Manager assignments error:', error);
      res.status(500).json({ message: 'Failed to fetch manager assignments' });
    }
  });

  // Create manager assignment
  app.post('/api/admin/manager-assignments', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const { userId, parkId } = req.body;
      await storage.assignManagerToPark(userId, parkId);
      res.status(204).send();
    } catch (error) {
      console.error('Create manager assignment error:', error);
      res.status(500).json({ message: 'Failed to create assignment' });
    }
  });

  // Remove all assignments for a manager
  app.delete('/api/admin/managers/:id/assignments', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.removeManagerAssignments(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Remove manager assignments error:', error);
      res.status(500).json({ message: 'Failed to remove assignments' });
    }
  });

  // Delete/remove manager
  app.delete('/api/admin/managers/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete manager error:', error);
      res.status(500).json({ message: 'Failed to delete manager' });
    }
  });

  // Get all invites
  app.get('/api/auth/invites', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const invites = await storage.getInvites();
      res.json({ invites });
    } catch (error) {
      console.error('Get invites error:', error);
      res.status(500).json({ message: 'Failed to fetch invites' });
    }
  });

  // Delete invite
  app.delete('/api/auth/invites/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.deleteInvite(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete invite error:', error);
      res.status(500).json({ message: 'Failed to delete invite' });
    }
  });

  // Delete photo (works for all entity types)
  app.delete('/api/photos/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      await storage.deletePhoto(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
