import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import { promises as fs } from "fs";
import multer from "multer";
import jwt from 'jsonwebtoken';
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

// Helper function to check if Google Calendar service is available
const isGoogleCalendarAvailable = () => googleCalendarService !== null;

import { 
  insertUserSchema,
  insertCompanySchema, 
  insertParkSchema, 
  insertLotSchema, 
  insertShowingSchema,
  insertAvailabilitySchema,
  insertPhotoSchema,
  insertInviteSchema,
  insertSpecialStatusSchema,
  insertTenantSchema,
  bookingSchema
} from "@shared/schema";
import { randomBytes, createHash } from "crypto";
import { sendInviteEmail, sendPasswordResetEmail, sendTenantInviteEmail } from "./email";

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
// Get environment-appropriate base URL
const getFrontendBaseUrl = () => {
  // If FRONTEND_BASE_URL is explicitly set, use it
  if (process.env.FRONTEND_BASE_URL) {
    return process.env.FRONTEND_BASE_URL;
  }
  
  // For Replit development environment
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // For Replit production environment (when deployed)
  if (process.env.REPL_SLUG) {
    return `https://${process.env.REPL_SLUG}.replit.app`;
  }
  
  // Try to detect the actual domain from the request
  // This will be set dynamically in the request handler
  return process.env.FRONTEND_BASE_URL || 'http://localhost:5000';
};

const FRONTEND_BASE_URL = getFrontendBaseUrl();

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
      const activeManagers = managers.filter(manager => manager.isActive);
      
      res.json({
        totalParks: totalParks.parks?.length || 0,
        activeLots: activeLots.length,
        monthlyBookings: monthlyBookings.length,
        activeManagers: activeManagers.length
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
      
      // Filter for valid bookings and sort by most recent first
      const recentBookings = showings
        .filter(showing => ['SCHEDULED', 'CONFIRMED', 'COMPLETED'].includes(showing.status))
        .sort((a, b) => new Date(b.createdAt || b.startDt).getTime() - new Date(a.createdAt || a.startDt).getTime())
        .slice(0, 10)
        .map(showing => ({
          ...showing,
          lotName: showing.lot?.nameOrNumber || `Lot ${showing.lotId.slice(0, 8)}...`,
          parkName: showing.lot?.park?.name || 'Unknown Park'
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

  // Manager enable/disable
  app.patch('/api/admin/managers/:id/toggle-active', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const manager = await storage.getUser(req.params.id);
      if (!manager || manager.role !== 'MANAGER') {
        return res.status(404).json({ message: 'Manager not found' });
      }
      const updatedManager = await storage.updateUser(req.params.id, {
        isActive: !manager.isActive
      });
      res.json(updatedManager);
    } catch (error) {
      console.error('Toggle manager active error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update manager details
  app.patch('/api/admin/managers/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const manager = await storage.getUser(req.params.id);
      if (!manager || manager.role !== 'MANAGER') {
        return res.status(404).json({ message: 'Manager not found' });
      }
      
      // Only allow updating fullName for now
      const { fullName } = req.body;
      if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
        return res.status(400).json({ message: 'Full name is required' });
      }
      
      const updatedManager = await storage.updateUser(req.params.id, {
        fullName: fullName.trim()
      });
      res.json(updatedManager);
    } catch (error) {
      console.error('Update manager error:', error);
      res.status(500).json({ message: 'Internal server error' });
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
      let totalLots = 0;
      for (const parkId of parkIds) {
        const activeLots = await storage.getLots({ parkId });
        const allLots = await storage.getLotsWithParkInfo({ parkId, includeInactive: true });
        availableLots += activeLots.filter(lot => lot.isActive).length;
        totalLots += allLots.length;
      }

      // Get database showings for fallback and completed/cancelled counts
      const showings = await storage.getShowings({ managerId: req.user!.id });
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Start of this week (Monday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);
      
      // End of this week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Try to get accurate counts from Google Calendar
      let scheduledCount = 0;
      let todayShowings = 0;
      let thisWeekShowings = 0;

      try {
        // Check if manager has Google Calendar connected
        const isConnected = await googleCalendarService.isCalendarConnected(req.user!.id);
        
        if (isConnected) {
          // Fetch calendar events for a broader range to get all property showings
          const oneMonthBack = new Date(today);
          oneMonthBack.setMonth(oneMonthBack.getMonth() - 1);
          const sixMonthsForward = new Date(today);
          sixMonthsForward.setMonth(sixMonthsForward.getMonth() + 6);
          
          const calendarEvents = await googleCalendarService.getUserCalendarEvents(
            req.user!.id, 
            oneMonthBack, 
            sixMonthsForward
          );

          // Filter property showing events - Google Calendar is the source of truth
          const propertyShowingEvents = calendarEvents.filter(event => 
            event.id && event.summary && event.summary.includes('Property Showing')
          );

          // Count scheduled showings (future events in calendar)
          scheduledCount = propertyShowingEvents.filter(event => {
            if (!event.start?.dateTime && !event.start?.date) return false;
            const eventStart = new Date(event.start.dateTime || event.start.date!);
            return eventStart > today;
          }).length;

          // Count today's showings (calendar events)
          todayShowings = propertyShowingEvents.filter(event => {
            if (!event.start?.dateTime && !event.start?.date) return false;
            const eventStart = new Date(event.start.dateTime || event.start.date!);
            return eventStart >= startOfDay && eventStart < endOfDay;
          }).length;

          // Count this week's showings (calendar events)
          thisWeekShowings = propertyShowingEvents.filter(event => {
            if (!event.start?.dateTime && !event.start?.date) return false;
            const eventStart = new Date(event.start.dateTime || event.start.date!);
            return eventStart >= startOfWeek && eventStart <= endOfWeek;
          }).length;
        } else {
          // Fallback to database counts if calendar not connected
          scheduledCount = showings.filter(showing => 
            showing.status === 'SCHEDULED' || showing.status === 'CONFIRMED'
          ).length;

          todayShowings = showings.filter(showing => {
            const showingDate = new Date(showing.startDt);
            return showingDate >= startOfDay && showingDate < endOfDay;
          }).length;

          thisWeekShowings = showings.filter(showing => {
            const showingDate = new Date(showing.startDt);
            return showingDate >= startOfWeek && showingDate <= endOfWeek;
          }).length;
        }
      } catch (calendarError) {
        console.log('Calendar verification failed, falling back to database counts:', calendarError);
        // Fallback to database counts
        scheduledCount = showings.filter(showing => 
          showing.status === 'SCHEDULED' || showing.status === 'CONFIRMED'
        ).length;

        todayShowings = showings.filter(showing => {
          const showingDate = new Date(showing.startDt);
          return showingDate >= startOfDay && showingDate < endOfDay;
        }).length;

        thisWeekShowings = showings.filter(showing => {
          const showingDate = new Date(showing.startDt);
          return showingDate >= startOfWeek && showingDate <= endOfWeek;
        }).length;
      }

      // Always use database for completed/cancelled counts as these are managed internally
      const completedCount = showings.filter(showing => showing.status === 'COMPLETED').length;
      const cancelledCount = showings.filter(showing => showing.status === 'CANCELED').length;

      res.json({
        todayShowings,
        thisWeekShowings,
        scheduledCount,
        completedCount,
        cancelledCount,
        availableLots,
        parkCount: parkIds.length,
        totalLots
      });
    } catch (error) {
      console.error('Manager stats error:', error);
      res.status(500).json({ message: 'Failed to fetch manager stats' });
    }
  });

  // Manager Parks Endpoint
  app.get('/api/manager/parks', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      let assignedParks = [];
      for (const parkId of parkIds) {
        // Use getParkAny to avoid filtering by isActive
        const park = await storage.getParkAny(parkId);
        if (park) {
          assignedParks.push(park);
        }
      }
      
      res.json({ parks: assignedParks });
    } catch (error) {
      console.error('Manager parks error:', error);
      res.status(500).json({ message: 'Failed to fetch parks' });
    }
  });

  // Manager Lots CRUD Endpoints
  app.get('/api/manager/lots', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getManagerAssignments(req.user!.id);
      const parkIds = assignments.map((a: any) => a.parkId);
      
      let allLots = [];
      for (const parkId of parkIds) {
        const lots = await storage.getLotsWithParkInfo({ parkId, includeInactive: true });
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
      console.log('=== MANAGER LOT UPDATE DEBUG ===');
      console.log('Lot ID:', req.params.id);
      console.log('Raw request body:', JSON.stringify(req.body, null, 2));
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Request body types:', Object.keys(req.body).map(key => `${key}: ${typeof req.body[key]}`));
      
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
      
      // Clean up empty strings in the request body
      const cleanedBody = { ...req.body };
      Object.keys(cleanedBody).forEach(key => {
        if (cleanedBody[key] === '') {
          cleanedBody[key] = null;
        }
      });
      
      console.log('Cleaned body:', JSON.stringify(cleanedBody, null, 2));
      
      // Try validation with detailed error reporting
      const validation = insertLotSchema.partial().safeParse(cleanedBody);
      if (!validation.success) {
        console.log('❌ Schema validation failed:');
        console.log('Validation errors:', JSON.stringify(validation.error.errors, null, 2));
        return res.status(400).json({ 
          message: 'Schema validation failed', 
          errors: validation.error.errors,
          receivedData: cleanedBody
        });
      }
      
      console.log('✅ Schema validation passed');
      console.log('Validated updates:', JSON.stringify(validation.data, null, 2));
      
      const updatedLot = await storage.updateLot(req.params.id, validation.data);
      console.log('✅ Database update successful');
      res.json(updatedLot);
    } catch (error) {
      console.error('❌ Update lot error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof Error) {
        res.status(400).json({ 
          message: error.message,
          errorType: error.constructor.name,
          stack: error.stack
        });
      } else {
        res.status(400).json({ 
          message: 'Unknown error occurred',
          error: String(error)
        });
      }
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

  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token required' });
      }

      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
      
      // Get the user from the decoded token
      const user = await storage.getUser(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid or inactive user' });
      }

      // Generate new tokens
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
      console.error('Token refresh error:', error);
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    // For JWT, logout is handled client-side by removing tokens
    res.json({ message: 'Logged out successfully' });
  });

  // Forgot Password Endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        // Don't reveal if email exists for security
        return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
      }

      // Generate a secure reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with hashed reset token
      await storage.updateUser(user.id, {
        resetToken: resetTokenHash,
        resetTokenExpiresAt
      });

      // Create reset URL dynamically based on the request
      const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(
        user.email,
        resetUrl,
        user.fullName
      );

      if (!emailSent) {
        console.error('Failed to send password reset email to:', user.email);
        return res.status(500).json({ message: 'Failed to send password reset email' });
      }

      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Reset Password Endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;
      
      if (!token || !password || !confirmPassword) {
        return res.status(400).json({ message: 'Token, password, and confirm password are required' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      
      if (!user || !user.resetToken || !user.resetTokenExpiresAt) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Check if token is expired
      if (new Date() > new Date(user.resetTokenExpiresAt)) {
        return res.status(400).json({ message: 'Reset token has expired' });
      }

      // Hash the new password
      const passwordHash = await hashPassword(password);

      // Update user password and clear reset token
      await storage.updateUser(user.id, {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null
      });

      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
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

  // Calendar sync endpoint - Admin only 
  app.post('/api/admin/sync-calendar', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      const dryRun = req.query.dryRun === 'true';
      console.log(`[Calendar Sync API] Starting ${dryRun ? 'DRY RUN' : 'LIVE'} sync triggered by admin user ${req.user?.id}`);
      
      const result = await googleCalendarService.syncShowingsWithCalendar(dryRun);
      
      console.log(`[Calendar Sync API] Sync completed. ${dryRun ? 'Would clean' : 'Cleaned'}: ${result.cleaned}, Errors: ${result.errors.length}, Audits: ${result.audits.length}`);
      
      res.json({
        success: true,
        dryRun,
        cleaned: result.cleaned,
        errors: result.errors,
        audits: result.audits,
        message: `${dryRun ? 'DRY RUN - Would clean' : 'Cleaned'} ${result.cleaned} orphaned records. ${result.errors.length} errors encountered.`
      });
    } catch (error) {
      console.error('[Calendar Sync API] Sync failed:', error);
      res.status(500).json({ 
        success: false,
        message: 'Calendar sync failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
      
      // Prioritize managers with connected Google Calendar
      let managerId = assignments[0].userId;
      let managerFound = false;
      
      for (const assignment of assignments) {
        const isCalendarConnected = await googleCalendarService.isCalendarConnected(assignment.userId);
        if (isCalendarConnected) {
          managerId = assignment.userId;
          managerFound = true;
          console.log(`[Manager Availability] Selected manager ${managerId} (has calendar connected) for lot ${lotId}`);
          break;
        }
      }
      
      if (!managerFound) {
        console.log(`[Manager Availability] Using first manager ${managerId} for lot ${lotId} (no managers have calendar connected)`);
      }
      
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
      role: req.user!.role,
      tenantId: req.user!.tenantId
    });
  });

  // User-Tenant Association routes
  app.get('/api/users/:id/tenant', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      
      // Only allow users to access their own data or admins to access any
      if (req.user!.role !== 'ADMIN' && req.user!.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const userWithTenant = await storage.getUserWithTenant(userId);
      if (!userWithTenant) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(userWithTenant);
    } catch (error) {
      console.error('Get user with tenant error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/users/:userId/link-tenant/:tenantId', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      const { userId, tenantId } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify user has TENANT role
      if (user.role !== 'TENANT') {
        return res.status(400).json({ 
          message: 'Only users with TENANT role can be linked to tenant records' 
        });
      }
      
      // Check if user is already linked to another tenant
      if (user.tenantId && user.tenantId !== tenantId) {
        return res.status(400).json({ 
          message: 'User is already linked to another tenant. Unlink first before linking to a new tenant.' 
        });
      }
      
      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }
      
      // Check if tenant is already linked to another user
      const existingUserWithTenant = await storage.getUserByTenantId(tenantId);
      if (existingUserWithTenant && existingUserWithTenant.id !== userId) {
        return res.status(400).json({ 
          message: 'This tenant is already linked to another user' 
        });
      }
      
      // Link user to tenant
      const updatedUser = await storage.linkUserToTenant(userId, tenantId);
      res.json({ 
        message: 'User linked to tenant successfully',
        user: updatedUser 
      });
    } catch (error) {
      console.error('Link user to tenant error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/users/:userId/unlink-tenant', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify user has TENANT role
      if (user.role !== 'TENANT') {
        return res.status(400).json({ 
          message: 'Only users with TENANT role can be unlinked from tenant records' 
        });
      }
      
      // Check if user is actually linked to a tenant
      if (!user.tenantId) {
        return res.status(400).json({ 
          message: 'User is not currently linked to any tenant' 
        });
      }
      
      // Unlink user from tenant
      const updatedUser = await storage.linkUserToTenant(userId, null as any);
      res.json({ 
        message: 'User unlinked from tenant successfully',
        user: updatedUser 
      });
    } catch (error) {
      console.error('Unlink user from tenant error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all tenant users with their association status
  app.get('/api/admin/tenant-users', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      // Get all users with TENANT role
      const tenantUsers = await storage.getUsers({ role: 'TENANT' as any });
      
      // Get tenant information for each user
      const usersWithTenantInfo = await Promise.all(
        tenantUsers.map(async (user) => {
          if (user.tenantId) {
            const tenant = await storage.getTenant(user.tenantId);
            return {
              ...user,
              tenant: tenant ? {
                id: tenant.id,
                firstName: tenant.firstName,
                lastName: tenant.lastName,
                email: tenant.email,
                status: tenant.status,
                lotId: tenant.lotId
              } : null,
              isLinked: true
            };
          } else {
            return {
              ...user,
              tenant: null,
              isLinked: false
            };
          }
        })
      );
      
      res.json({ 
        tenantUsers: usersWithTenantInfo,
        total: usersWithTenantInfo.length,
        linked: usersWithTenantInfo.filter(u => u.isLinked).length,
        unlinked: usersWithTenantInfo.filter(u => !u.isLinked).length
      });
    } catch (error) {
      console.error('Get tenant users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invite routes
  app.get('/api/auth/invites/validate/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
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
        // If user exists but is inactive (tenant created but not activated), allow validation
        if (!existingUser.isActive && existingUser.role === invite.role) {
          // Allow validation to proceed - user can be updated during accept
        } else {
          return res.status(409).json({ message: 'User already exists and is active' });
        }
      }

      res.json({ 
        email: invite.email,
        role: invite.role,
        valid: true 
      });
    } catch (error) {
      console.error('Validate invite error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

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
        token,
        expiresAt
      } as any);

      // Send invite email
      const inviteUrl = `${req.protocol}://${req.get('host')}/accept-invite?token=${token}`;
      const emailSent = await sendInviteEmail(
        invite.email,
        inviteUrl,
        req.user!.fullName
      );

      if (!emailSent) {
        console.error('Failed to send invite email to:', invite.email);
      }

      res.status(201).json({ 
        ...invite,
        inviteUrl,
        emailSent
      });
    } catch (error) {
      console.error('Create invite error:', error);
      res.status(400).json({ message: 'Invalid invite data' });
    }
  });

  app.post('/api/auth/accept-invite', async (req, res) => {
    try {
      const { token, password, fullName } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password required' });
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
      let user;
      
      if (existingUser) {
        // If user exists but is inactive (tenant created but not activated), update their info
        if (!existingUser.isActive && existingUser.role === invite.role) {
          const passwordHash = await hashPassword(password);
          
          // For tenants, get the name from the tenant record if no fullName provided
          let finalFullName = fullName;
          if (invite.role === 'TENANT' && !fullName && existingUser.tenantId) {
            const tenantInfo = await storage.getTenantByUserId(existingUser.id);
            if (tenantInfo) {
              finalFullName = `${tenantInfo.firstName} ${tenantInfo.lastName}`;
            }
          }
          
          user = await storage.updateUser(existingUser.id, {
            passwordHash,
            fullName: finalFullName,
            isActive: true
          });
        } else {
          return res.status(409).json({ message: 'User already exists and is active' });
        }
      } else {
        // Create new user
        const passwordHash = await hashPassword(password);
        
        // For tenants, get the name from the tenant record if no fullName provided
        let finalFullName = fullName;
        if (invite.role === 'TENANT' && !fullName) {
          // Find tenant by email to get their name
          const tenantInfo = await storage.getTenantByEmail(invite.email);
          if (tenantInfo) {
            finalFullName = `${tenantInfo.firstName} ${tenantInfo.lastName}`;
          }
        }
        
        user = await storage.createUser({
          email: invite.email,
          passwordHash,
          fullName: finalFullName,
          role: invite.role,
          isActive: true
        });
      }

      // Mark invite as accepted
      await storage.acceptInvite(token);

      // If this is a tenant user, update their tenant status to ACTIVE
      if (invite.role === 'TENANT') {
        try {
          const tenant = await storage.getTenantByEmail(invite.email);
          if (tenant) {
            await storage.updateTenant(tenant.id, { status: 'ACTIVE' });
          }
        } catch (tenantError) {
          console.error('Failed to update tenant status:', tenantError);
          // Don't fail the entire request if tenant status update fails
        }
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
      console.error('Accept invite error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company routes
  app.get('/api/companies', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const { includeInactive } = req.query;
      const companies = await storage.getCompanies(includeInactive === 'true');
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

  // Company enable/disable
  app.patch('/api/companies/:id/toggle-active', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const company = await storage.getCompanyAny(req.params.id);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }
      const updatedCompany = await storage.updateCompany(req.params.id, {
        isActive: !company.isActive
      });
      res.json(updatedCompany);
    } catch (error) {
      console.error('Toggle company active error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Park routes (public and protected)
  app.get('/api/parks', async (req: AuthRequest, res) => {
    try {
      const { companyId, city, state, q, status, price, page = '1', limit = '20', includeInactive } = req.query;
      
      // Only admins can see inactive entities
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'ADMIN';
      
      // Parse price range if provided
      let minPrice: number | undefined;
      let maxPrice: number | undefined;
      if (price && price !== 'all') {
        const priceStr = price as string;
        if (priceStr === 'under-1000') {
          maxPrice = 1000;
        } else if (priceStr === '1000-2000') {
          minPrice = 1000;
          maxPrice = 2000;
        } else if (priceStr === '2000-3000') {
          minPrice = 2000;
          maxPrice = 3000;
        } else if (priceStr === 'over-3000') {
          minPrice = 3000;
        }
      }
      
      const filters = {
        companyId: companyId as string,
        city: city as string,
        state: state as string,
        q: q as string,
        status: (status && status !== 'all') ? status as string : undefined,
        minPrice,
        maxPrice,
        includeInactive: shouldIncludeInactive
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

  // Park enable/disable
  app.patch('/api/parks/:id/toggle-active', authenticateToken, requireParkAccess, async (req, res) => {
    try {
      const park = await storage.getParkAny(req.params.id);
      if (!park) {
        return res.status(404).json({ message: 'Park not found' });
      }
      const updatedPark = await storage.updatePark(req.params.id, {
        isActive: !park.isActive
      });
      res.json(updatedPark);
    } catch (error) {
      console.error('Toggle park active error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Special Status routes
  // Get all special statuses for a park
  app.get('/api/parks/:parkId/special-statuses', authenticateToken, requireParkAccess, async (req: AuthRequest, res) => {
    try {
      const { includeInactive } = req.query;
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'ADMIN';
      
      const specialStatuses = await storage.getSpecialStatuses(
        req.params.parkId, 
        shouldIncludeInactive
      );
      res.json(specialStatuses);
    } catch (error) {
      console.error('Get special statuses error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Create a new special status for a park
  app.post('/api/parks/:parkId/special-statuses', authenticateToken, requireParkAccess, async (req: AuthRequest, res) => {
    try {
      // Validate request body
      const validatedData = insertSpecialStatusSchema.parse({
        ...req.body,
        parkId: req.params.parkId
      });

      const specialStatus = await storage.createSpecialStatus(validatedData);
      res.status(201).json(specialStatus);
    } catch (error: any) {
      console.error('Create special status error:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update a special status
  app.put('/api/special-statuses/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // First get the special status to check park access
      const existingStatus = await storage.getSpecialStatus(req.params.id);
      if (!existingStatus) {
        return res.status(404).json({ message: 'Special status not found' });
      }

      // Check if user has access to the park this special status belongs to
      // This uses the same park access logic as other endpoints
      const managerAssignments = req.user?.role === 'MANAGER' 
        ? await storage.getManagerAssignments(req.user.id, existingStatus.parkId)
        : [];
      const hasAccess = req.user?.role === 'ADMIN' || 
        (req.user?.role === 'MANAGER' && managerAssignments.length > 0);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Validate request body (exclude parkId from updates, allow partial updates)
      const validatedData = insertSpecialStatusSchema.omit({ parkId: true }).partial().parse(req.body);

      const updatedStatus = await storage.updateSpecialStatus(req.params.id, validatedData);
      res.json(updatedStatus);
    } catch (error: any) {
      console.error('Update special status error:', error);
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: 'Invalid request data', errors: error.errors });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Delete a special status
  app.delete('/api/special-statuses/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // First get the special status to check park access
      const existingStatus = await storage.getSpecialStatus(req.params.id);
      if (!existingStatus) {
        return res.status(404).json({ message: 'Special status not found' });
      }

      // Check if user has access to the park this special status belongs to
      const managerAssignments = req.user?.role === 'MANAGER' 
        ? await storage.getManagerAssignments(req.user.id, existingStatus.parkId)
        : [];
      const hasAccess = req.user?.role === 'ADMIN' || 
        (req.user?.role === 'MANAGER' && managerAssignments.length > 0);
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteSpecialStatus(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete special status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Assign or remove special status from a lot
  app.put('/api/lots/:lotId/special-status', authenticateToken, requireLotAccess, async (req: AuthRequest, res) => {
    try {
      const { specialStatusId } = req.body;
      
      // If specialStatusId is provided, validate it exists and belongs to the same park as the lot
      if (specialStatusId) {
        const lot = await storage.getLot(req.params.lotId);
        const specialStatus = await storage.getSpecialStatus(specialStatusId);
        
        if (!lot || !specialStatus) {
          return res.status(404).json({ message: 'Lot or special status not found' });
        }
        
        if (lot.parkId !== specialStatus.parkId) {
          return res.status(400).json({ message: 'Special status must belong to the same park as the lot' });
        }
      }

      // Update the lot with the new special status (null to remove)
      const updatedLot = await storage.updateLot(req.params.lotId, {
        specialStatusId: specialStatusId || null
      });
      
      res.json(updatedLot);
    } catch (error) {
      console.error('Assign special status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Bulk upload lots (admin only)
  app.post('/api/admin/lots/bulk', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      const { lots } = req.body;
      
      if (!Array.isArray(lots) || lots.length === 0) {
        return res.status(400).json({ message: 'Lots array is required' });
      }

      if (lots.length > 1000) {
        return res.status(400).json({ message: 'Maximum 1000 lots per upload' });
      }

      const results: { successful: any[], failed: any[] } = { successful: [], failed: [] };
      
      for (let i = 0; i < lots.length; i++) {
        const lotData = lots[i];
        const rowNumber = i + 1;
        
        try {
          // Validate required fields
          if (!lotData.nameOrNumber) {
            results.failed.push({
              row: rowNumber,
              error: 'Missing required fields: nameOrNumber'
            });
            continue;
          }

          // Validate status enum if provided
          if (lotData.status && !['FOR_RENT', 'FOR_SALE', 'RENT_TO_OWN', 'CONTRACT_FOR_DEED'].includes(lotData.status)) {
            results.failed.push({
              row: rowNumber,
              error: 'Invalid status. Must be: FOR_RENT, FOR_SALE, RENT_TO_OWN, or CONTRACT_FOR_DEED'
            });
            continue;
          }

          // Determine park ID - prioritize park name over park ID
          let lotParkId: string;
          
          // Check if parkName is provided first (prioritized)
          if (lotData.parkName && String(lotData.parkName).trim()) {
            const parkName = String(lotData.parkName).trim();
            const { parks: allParks } = await storage.getParks();
            const matchingPark = allParks.find(p => 
              p.name.toLowerCase() === parkName.toLowerCase()
            );
            if (matchingPark) {
              lotParkId = matchingPark.id;
            } else {
              const availableParks = allParks.map(p => p.name).join(', ');
              results.failed.push({
                row: rowNumber,
                error: `Park '${parkName}' not found. Available parks: ${availableParks}`
              });
              continue;
            }
          }
          // Fallback to parkId if no parkName provided
          else if (lotData.parkId && String(lotData.parkId).trim()) {
            const parkId = String(lotData.parkId).trim();
            const park = await storage.getPark(parkId);
            if (!park) {
              results.failed.push({
                row: rowNumber,
                error: `Park with ID ${parkId} not found`
              });
              continue;
            }
            lotParkId = parkId;
          }
          // Neither park name nor park ID provided
          else {
            results.failed.push({
              row: rowNumber,
              error: 'Park Name or Park ID must be specified'
            });
            continue;
          }

          // Handle special status if provided
          let specialStatusId: string | null = null;
          if (lotData.specialStatus && String(lotData.specialStatus).trim()) {
            const specialStatusName = String(lotData.specialStatus).trim();
            try {
              const specialStatus = await storage.findOrCreateSpecialStatus(lotParkId, specialStatusName);
              specialStatusId = specialStatus.id;
            } catch (error) {
              results.failed.push({
                row: rowNumber,
                error: `Failed to create/assign special status '${specialStatusName}': ${error instanceof Error ? error.message : 'Unknown error'}`
              });
              continue;
            }
          }

          // Parse and validate numeric fields
          const parsedData = {
            nameOrNumber: String(lotData.nameOrNumber).trim(),
            status: lotData.status,
            parkId: lotParkId,
            price: lotData.price && String(lotData.price).trim() !== "" ? String(lotData.price) : "0",
            description: lotData.description ? String(lotData.description).trim() : "",
            bedrooms: lotData.bedrooms && String(lotData.bedrooms).trim() !== "" ? parseInt(lotData.bedrooms) || null : null,
            bathrooms: lotData.bathrooms && String(lotData.bathrooms).trim() !== "" ? parseInt(lotData.bathrooms) || null : null,
            sqFt: lotData.sqFt && String(lotData.sqFt).trim() !== "" ? parseInt(lotData.sqFt) || null : null,
            specialStatusId,
            isActive: true
          };

          // Create the lot
          const newLot = await storage.createLot(parsedData as any);
          results.successful.push({
            row: rowNumber,
            id: newLot.id,
            nameOrNumber: newLot.nameOrNumber
          });

        } catch (error) {
          console.error(`Error creating lot at row ${rowNumber}:`, error);
          results.failed.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ message: 'Internal server error during bulk upload' });
    }
  });

  // Bulk upload lots for managers (auto-assigns to manager's park)
  app.post('/api/manager/lots/bulk', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const { lots } = req.body;
      
      if (!Array.isArray(lots) || lots.length === 0) {
        return res.status(400).json({ message: 'Lots array is required' });
      }

      if (lots.length > 1000) {
        return res.status(400).json({ message: 'Maximum 1000 lots per upload' });
      }

      // Get manager's assigned parks
      const assignments = await storage.getManagerAssignments(req.user!.id);
      if (assignments.length === 0) {
        return res.status(403).json({ message: 'Manager is not assigned to any parks' });
      }

      // Handle single vs multi-park scenarios
      const isMultiPark = assignments.length > 1;
      let defaultParkId: string | null = null;
      let assignedParkName = '';
      
      if (!isMultiPark) {
        // Single park - use automatic assignment
        defaultParkId = assignments[0].parkId;
        assignedParkName = assignments[0].parkName;
      }

      const results: { successful: any[], failed: any[], assignedPark?: string, multiPark?: boolean, assignedParks?: any[] } = { 
        successful: [], 
        failed: [],
        ...(isMultiPark ? { 
          multiPark: true, 
          assignedParks: assignments.map(a => ({ id: a.parkId, name: a.parkName }))
        } : { 
          assignedPark: assignedParkName 
        })
      };
      
      for (let i = 0; i < lots.length; i++) {
        const lotData = lots[i];
        const rowNumber = i + 1;
        
        try {
          // Validate required fields (park ID is automatically assigned)
          if (!lotData.nameOrNumber) {
            results.failed.push({
              row: rowNumber,
              error: 'Missing required fields: nameOrNumber'
            });
            continue;
          }

          // Validate status enum if provided
          if (lotData.status && !['FOR_RENT', 'FOR_SALE', 'RENT_TO_OWN', 'CONTRACT_FOR_DEED'].includes(lotData.status)) {
            results.failed.push({
              row: rowNumber,
              error: 'Invalid status. Must be: FOR_RENT, FOR_SALE, RENT_TO_OWN, or CONTRACT_FOR_DEED'
            });
            continue;
          }

          // Determine park ID for this lot
          let lotParkId: string;
          
          if (isMultiPark) {
            // Multi-park manager: check for park specification in CSV
            let specifiedParkId: string | null = null;
            
            // Check if parkName is provided and resolve to ID (prioritized)
            if (lotData.parkName && String(lotData.parkName).trim()) {
              const parkName = String(lotData.parkName).trim();
              const matchingPark = assignments.find(a => 
                a.parkName.toLowerCase() === parkName.toLowerCase()
              );
              if (matchingPark) {
                specifiedParkId = matchingPark.parkId;
              } else {
                results.failed.push({
                  row: rowNumber,
                  error: `Park '${parkName}' not found in your assigned parks: ${assignments.map(a => a.parkName).join(', ')}`
                });
                continue;
              }
            }
            // Fallback to parkId if no parkName provided
            else if (lotData.parkId && String(lotData.parkId).trim()) {
              specifiedParkId = String(lotData.parkId).trim();
            }
            
            // Validate park assignment
            if (specifiedParkId) {
              const hasAccess = assignments.some(a => a.parkId === specifiedParkId);
              if (!hasAccess) {
                results.failed.push({
                  row: rowNumber,
                  error: `You don't have access to park ID '${specifiedParkId}'. Available parks: ${assignments.map(a => `${a.parkName} (${a.parkId})`).join(', ')}`
                });
                continue;
              }
              lotParkId = specifiedParkId;
            } else {
              results.failed.push({
                row: rowNumber,
                error: 'Park ID or Park Name must be specified for multi-park managers. Available parks: ' + assignments.map(a => `${a.parkName} (${a.parkId})`).join(', ')
              });
              continue;
            }
          } else {
            // Single park manager: use automatic assignment
            lotParkId = defaultParkId!;
          }

          // Handle special status if provided
          let specialStatusId: string | null = null;
          if (lotData.specialStatus && String(lotData.specialStatus).trim()) {
            const specialStatusName = String(lotData.specialStatus).trim();
            try {
              const specialStatus = await storage.findOrCreateSpecialStatus(lotParkId, specialStatusName);
              specialStatusId = specialStatus.id;
            } catch (error) {
              results.failed.push({
                row: rowNumber,
                error: `Failed to create/assign special status '${specialStatusName}': ${error instanceof Error ? error.message : 'Unknown error'}`
              });
              continue;
            }
          }

          // Parse and validate numeric fields
          const parsedData = {
            nameOrNumber: String(lotData.nameOrNumber).trim(),
            status: lotData.status,
            parkId: lotParkId,
            price: lotData.price && String(lotData.price).trim() !== "" ? String(lotData.price) : "0",
            description: lotData.description ? String(lotData.description).trim() : "",
            bedrooms: lotData.bedrooms && String(lotData.bedrooms).trim() !== "" ? parseInt(lotData.bedrooms) || null : null,
            bathrooms: lotData.bathrooms && String(lotData.bathrooms).trim() !== "" ? parseInt(lotData.bathrooms) || null : null,
            sqFt: lotData.sqFt && String(lotData.sqFt).trim() !== "" ? parseInt(lotData.sqFt) || null : null,
            specialStatusId,
            isActive: true
          };

          // Create the lot
          const newLot = await storage.createLot(parsedData as any);
          results.successful.push({
            row: rowNumber,
            id: newLot.id,
            nameOrNumber: newLot.nameOrNumber
          });

        } catch (error) {
          console.error(`Error creating lot at row ${rowNumber}:`, error);
          results.failed.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Manager bulk upload error:', error);
      res.status(500).json({ message: 'Internal server error during bulk upload' });
    }
  });

  // Public lot routes (no authentication required for client viewing)
  app.get('/api/public/lots', async (req: Request, res: Response) => {
    console.log('Public lots endpoint hit:', req.url, req.query);
    
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
        q: q as string,
        includeInactive: false // Only show active lots for public view
      };

      console.log('Fetching lots with filters:', filters);
      
      // Test database connection first
      if (!storage) {
        throw new Error('Storage not initialized');
      }
      
      const lots = await storage.getLotsWithParkInfo(filters);
      console.log(`Found ${lots.length} lots`);
      
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;
      
      const paginatedLots = lots.slice(offset, offset + limitNum);
      
      const response = {
        lots: paginatedLots,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: lots.length,
          pages: Math.ceil(lots.length / limitNum)
        }
      };
      
      console.log('Sending response:', { 
        totalLots: lots.length, 
        paginatedCount: paginatedLots.length,
        responseSize: JSON.stringify(response).length 
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(response);
      
    } catch (error) {
      console.error('Error in public lots endpoint:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).setHeader('Content-Type', 'application/json').json({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Lot routes (authenticated)
  app.get('/api/lots', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { parkId, status, minPrice, maxPrice, bedrooms, bathrooms, state, q, price, page = '1', limit = '20', includeInactive } = req.query;
      
      // Only admins can see inactive entities
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'ADMIN';
      
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
        q: q as string,
        includeInactive: shouldIncludeInactive
      };

      const lots = await storage.getLotsWithParkInfo(filters);
      
      const pageNum = parseInt(page as string);
      // Allow higher limits for admins, but cap at reasonable number for others
      const maxLimit = req.user?.role === 'ADMIN' ? 10000 : 100;
      const limitNum = Math.min(parseInt(limit as string), maxLimit);
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
      console.log(`Fetching lot with ID: ${req.params.id}`);
      const lot = await storage.getLot(req.params.id);
      if (!lot) {
        console.log(`Lot not found: ${req.params.id}`);
        return res.status(404).json({ message: 'Lot not found' });
      }
      console.log(`Successfully fetched lot: ${lot.nameOrNumber}`);
      res.json(lot);
    } catch (error) {
      console.error('Get lot error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        lotId: req.params.id
      });
      res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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
      console.log('=== ADMIN LOT UPDATE DEBUG ===');
      console.log('Lot ID:', req.params.id);
      console.log('Raw request body:', JSON.stringify(req.body, null, 2));
      console.log('Request body keys:', Object.keys(req.body));
      console.log('Request body types:', Object.keys(req.body).map(key => `${key}: ${typeof req.body[key]}`));
      
      // Clean up empty strings in the request body
      const cleanedBody = { ...req.body };
      Object.keys(cleanedBody).forEach(key => {
        if (cleanedBody[key] === '') {
          cleanedBody[key] = null;
        }
      });
      
      console.log('Cleaned body:', JSON.stringify(cleanedBody, null, 2));
      
      // Try validation with detailed error reporting
      const validation = insertLotSchema.partial().safeParse(cleanedBody);
      if (!validation.success) {
        console.log('❌ Schema validation failed:');
        console.log('Validation errors:', JSON.stringify(validation.error.errors, null, 2));
        return res.status(400).json({ 
          message: 'Schema validation failed', 
          errors: validation.error.errors,
          receivedData: cleanedBody
        });
      }
      
      console.log('✅ Schema validation passed');
      console.log('Validated updates:', JSON.stringify(validation.data, null, 2));
      
      const lot = await storage.updateLot(req.params.id, validation.data);
      console.log('✅ Database update successful');
      res.json(lot);
    } catch (error) {
      console.error('❌ Update lot error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (error instanceof Error) {
        res.status(400).json({ 
          message: error.message,
          errorType: error.constructor.name,
          stack: error.stack
        });
      } else {
        res.status(400).json({ 
          message: 'Unknown error occurred',
          error: String(error)
        });
      }
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

  // Bulk lot upload
  app.post('/api/lots/bulk', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { rows, skipIfExists = false } = req.body;
      
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: 'Rows array is required and cannot be empty' });
      }

      if (rows.length > 1000) {
        return res.status(400).json({ message: 'Maximum 1000 rows per batch allowed' });
      }

      const results = [];
      const isAdmin = req.user!.role === 'ADMIN';
      let managerParkIds: string[] = [];
      
      // Get manager assignments if user is a manager
      if (!isAdmin) {
        const assignments = await storage.getManagerAssignments(req.user!.id);
        managerParkIds = assignments.map((a: any) => a.parkId);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          // Validate lot data using schema
          const lotData = insertLotSchema.parse(row);
          
          // Check park access for managers
          if (!isAdmin && !managerParkIds.includes(lotData.parkId)) {
            results.push({
              index: i,
              ok: false,
              error: 'You can only create lots in your assigned parks'
            });
            continue;
          }

          // Check if lot already exists (if skipIfExists is enabled)
          if (skipIfExists) {
            const existingLots = await storage.getLotsWithParkInfo({ 
              parkId: lotData.parkId,
              includeInactive: true 
            });
            const exists = existingLots.some(lot => 
              lot.nameOrNumber.toLowerCase() === lotData.nameOrNumber.toLowerCase()
            );
            
            if (exists) {
              results.push({
                index: i,
                ok: false,
                error: 'Lot with this name already exists in the park (skipped)'
              });
              continue;
            }
          }

          // Create the lot
          const lot = await storage.createLot(lotData);
          results.push({
            index: i,
            ok: true,
            id: lot.id,
            data: lot
          });
        } catch (error) {
          console.error(`Bulk upload error for row ${i}:`, error);
          results.push({
            index: i,
            ok: false,
            error: error instanceof Error ? error.message : 'Validation error'
          });
        }
      }

      // Calculate summary stats
      const successful = results.filter(r => r.ok).length;
      const failed = results.length - successful;

      res.json({
        results,
        summary: {
          total: rows.length,
        successful,
          failed
        }
      });
    } catch (error) {
      console.error('Bulk lot upload error:', error);
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

  // Lot enable/disable
  app.patch('/api/lots/:id/toggle-active', authenticateToken, requireLotAccess, async (req, res) => {
    try {
      const lot = await storage.getLotAny(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      const updatedLot = await storage.updateLot(req.params.id, {
        isActive: !lot.isActive
      });
      res.json(updatedLot);
    } catch (error) {
      console.error('Toggle lot active error:', error);
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

  // Tenant routes
  app.get('/api/tenants', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { status, lotId, q } = req.query;
      console.log('Fetching tenants with filters:', { status, lotId, q });
      
      // Temporary: Return empty array until database is set up
      // TODO: Implement actual database queries once tables are created
      try {
        // Try to get tenants from database
        const tenants = await storage.getTenantsWithLotInfo({
          status: status as string,
          q: q as string
        });
        
        // For managers, filter by their assigned parks
        if (req.user!.role === 'MANAGER') {
          const assignments = await storage.getManagerAssignments(req.user!.id);
          const parkIds = assignments.map(a => a.parkId);
          
          if (parkIds.length === 0) {
            return res.json({ tenants: [] });
          }
          
          const filteredTenants = tenants.filter(Tenant => 
            Tenant.lot && parkIds.includes(Tenant.lot.parkId)
          );
          return res.json({ tenants: filteredTenants });
        }
        
        res.json({ tenants });
      } catch (dbError) {
        console.log('Database not ready for tenants, returning empty array:', dbError);
        // Return empty array if database tables don't exist yet
        res.json({ tenants: [] });
      }
    } catch (error) {
      console.error('Get tenants error:', error);
      res.status(500).json({ message: 'Failed to fetch tenants' });
    }
  });

  app.get('/api/tenants/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.id;
      const Tenant = await storage.getTenant(tenantId);
      
      if (!Tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // For managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // Get Tenant with lot and park info
      const tenantWithInfo = await storage.getTenantsWithLotInfo();
      const fullTenant = tenantWithInfo.find(t => t.id === tenantId);
      
      res.json({ Tenant: fullTenant || Tenant });
    } catch (error) {
      console.error('Get Tenant error:', error);
      res.status(500).json({ message: 'Failed to fetch Tenant' });
    }
  });


  app.post('/api/tenants', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Extract Tenant data from request body (handle nested structure)
      let rawTenantData = req.body;
      if (req.body.Tenant) {
        rawTenantData = req.body.Tenant;
      }

      // Clean up all fields - convert empty strings to null for optional fields
      Object.keys(rawTenantData).forEach(key => {
        if (rawTenantData[key] === '' && key !== 'firstName' && key !== 'lastName' && key !== 'email' && key !== 'phone' && key !== 'lotId') {
          rawTenantData[key] = null;
        }
      });
      
      // Remove fields that shouldn't be in the creation request
      delete rawTenantData.id;
      delete rawTenantData.createdAt;
      delete rawTenantData.updatedAt;
      
      console.log('Cleaned Tenant data:', rawTenantData);

      // Validate Tenant data
      const validation = insertTenantSchema.safeParse(rawTenantData);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid Tenant data', 
          errors: validation.error.errors 
        });
      }

      const tenantData = validation.data;

      // Additional validation for required fields
      if (!tenantData.lotId || tenantData.lotId.trim() === '') {
        return res.status(400).json({ 
          message: 'Lot ID is required and cannot be empty'
        });
      }

      if (!tenantData.firstName || tenantData.firstName.trim() === '') {
        return res.status(400).json({ 
          message: 'First name is required and cannot be empty' 
        });
      }

      if (!tenantData.lastName || tenantData.lastName.trim() === '') {
        return res.status(400).json({ 
          message: 'Last name is required and cannot be empty' 
        });
      }

      // For managers, verify they have access to the specified lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(tenantData.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this lot' });
        }
      }

      // Check if a tenant with this email already exists
      console.log('Checking for existing tenant with email:', tenantData.email);
      const existingTenant = await storage.getTenantByEmail(tenantData.email);
      console.log('Existing tenant found:', existingTenant);
      if (existingTenant) {
        console.log('Duplicate email detected, rejecting request');
        return res.status(400).json({ 
          message: 'A tenant with this email already exists' 
        });
      }

      // Check if a user with this email already exists
      const existingUser = await storage.getUserByEmail(tenantData.email);
      let user = existingUser;
      let userCreated = false;
      let inviteCreated = false;
      let emailSent = false;

      if (existingUser) {
        // If user already exists, check if they have TENANT role
        if (existingUser.role !== 'TENANT') {
          return res.status(400).json({ 
            message: 'A user with this email already exists with a different role' 
          });
        }
        user = existingUser;
      } else {
        // Create user with TENANT role (without password - will be set via invite)
        try {
          // Generate a temporary password hash (will be replaced when they accept invite)
          const tempPasswordHash = await hashPassword(randomBytes(32).toString('hex'));
          
          user = await storage.createUser({
            email: tenantData.email,
            passwordHash: tempPasswordHash,
            fullName: `${tenantData.firstName} ${tenantData.lastName}`,
            role: 'TENANT',
            isActive: false // Will be activated when they accept the invite
          });
          userCreated = true;
        } catch (userError) {
          console.error('Failed to create user for tenant:', userError);
          return res.status(500).json({ message: 'Failed to create user account' });
        }
      }

      // Create the tenant record associated with the user
      let Tenant;
      try {
        Tenant = await storage.createTenant(tenantData);
        
        // Link the user to the tenant
        if (user) {
          await storage.linkUserToTenant(user.id, Tenant.id);
        }

        // Automatically set the lot to "Hidden" status when a tenant is assigned
        try {
          const lot = await storage.getLot(tenantData.lotId);
          if (lot) {
            // Find or create "Hidden" special status for this park
            const hiddenStatus = await storage.findOrCreateSpecialStatus(lot.parkId, 'Hidden');
            
            // Update the lot with the Hidden status
            await storage.updateLot(tenantData.lotId, {
              specialStatusId: hiddenStatus.id
            });
            
            console.log(`Lot ${lot.nameOrNumber} automatically set to Hidden status due to tenant assignment`);
          }
        } catch (statusError) {
          console.error('Failed to set lot to Hidden status:', statusError);
          // Don't fail the entire request if status update fails
        }
      } catch (tenantError) {
        console.error('Failed to create tenant:', tenantError);
        // If we created a user but failed to create tenant, clean up the user
        if (userCreated && user) {
          try {
            await storage.deleteUser(user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup user after tenant creation failure:', cleanupError);
          }
        }
        return res.status(500).json({ message: 'Failed to create tenant record' });
      }

      // Create invite and send email only for new users
      if (userCreated) {
        try {
          // Create an invite for the tenant to set up their account
          const token = randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

          const invite = await storage.createInvite({
            email: tenantData.email,
            role: 'TENANT',
            createdByUserId: req.user!.id,
            token,
            expiresAt
          } as any);
          inviteCreated = true;

          // Get lot and park information for the email
          const lot = await storage.getLot(tenantData.lotId);
          let lotInfo = `Lot ${tenantData.lotId}`;
          if (lot) {
            const lotWithPark = await storage.getLotsWithParkInfo({ parkId: lot.parkId });
            const lotDetails = lotWithPark.find(l => l.id === lot.id);
            if (lotDetails && lotDetails.park) {
              lotInfo = `Lot ${lot.nameOrNumber} at ${lotDetails.park.name}`;
            } else {
              lotInfo = `Lot ${lot.nameOrNumber}`;
            }
          }

          // Send tenant invitation email
          // Construct URL dynamically based on the request
          const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
          const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
          const baseUrl = `${protocol}://${host}`;
          const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
          
          console.log('Constructed invite URL:', inviteUrl);
          console.log('Request headers:', { 
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'x-forwarded-host': req.headers['x-forwarded-host'],
            host: req.headers.host,
            secure: req.secure
          });
          emailSent = await sendTenantInviteEmail(
            tenantData.email,
            inviteUrl,
            `${tenantData.firstName} ${tenantData.lastName}`,
            lotInfo,
            req.user!.fullName
          );

          if (!emailSent) {
            console.error('Failed to send tenant invitation email to:', tenantData.email);
          }
        } catch (inviteError) {
          console.error('Failed to create tenant invite:', inviteError);
          // Don't fail the tenant creation if invite fails
        }
      }

      res.status(201).json({ 
        Tenant,
        user: {
          id: user?.id,
          email: user?.email,
          fullName: user?.fullName,
          role: user?.role
        },
        userCreated,
        inviteCreated,
        emailSent
      });
    } catch (error) {
      console.error('Create Tenant error:', error);
      res.status(500).json({ message: 'Failed to create Tenant' });
    }
  });

  app.patch('/api/tenants/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.id;
      let updates = { ...req.body };

      const existingTenant = await storage.getTenant(tenantId);
      if (!existingTenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // For managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(existingTenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // Handle date string conversion for lease dates
      if (updates.leaseStartDate) {
        if (typeof updates.leaseStartDate === 'string') {
          const date = new Date(updates.leaseStartDate);
          updates.leaseStartDate = isNaN(date.getTime()) ? null : date;
        }
      }
      
      if (updates.leaseEndDate) {
        if (typeof updates.leaseEndDate === 'string') {
          const date = new Date(updates.leaseEndDate);
          updates.leaseEndDate = isNaN(date.getTime()) ? null : date;
        }
      }

      // Clean up empty strings to null for optional fields
      Object.keys(updates).forEach(key => {
        if (updates[key] === '' && !['firstName', 'lastName', 'email', 'phone', 'lotId'].includes(key)) {
          updates[key] = null;
        }
      });

      // If email is being updated, check for uniqueness
      if (updates.email && updates.email !== existingTenant.email) {
        const existingTenantWithEmail = await storage.getTenantByEmail(updates.email);
        if (existingTenantWithEmail && existingTenantWithEmail.id !== tenantId) {
          return res.status(400).json({ 
            message: 'A tenant with this email already exists' 
          });
        }
      }

      // Validate the updates using the schema
      const validation = insertTenantSchema.partial().safeParse(updates);
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid tenant data', 
          errors: validation.error.errors 
        });
      }

      const Tenant = await storage.updateTenant(tenantId, updates);
      res.json({ Tenant });
    } catch (error) {
      console.error('Update Tenant error:', error);
      res.status(500).json({ message: 'Failed to update Tenant' });
    }
  });

  app.delete('/api/tenants/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.id;
      
      const Tenant = await storage.getTenant(tenantId);
      if (!Tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // For managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // Store lot info before deleting tenant
      const lot = await storage.getLot(Tenant.lotId);
      
      await storage.deleteTenant(tenantId);
      
      // Remove "Hidden" status from the lot when tenant is deleted
      if (lot && lot.specialStatusId) {
        try {
          const specialStatus = await storage.getSpecialStatus(lot.specialStatusId);
          if (specialStatus && specialStatus.name === 'Hidden') {
            // Remove the Hidden status
            await storage.updateLot(lot.id, {
              specialStatusId: null
            });
            console.log(`Removed Hidden status from lot ${lot.nameOrNumber} after tenant deletion`);
          }
        } catch (statusError) {
          console.error('Failed to remove Hidden status from lot:', statusError);
          // Don't fail the entire request if status update fails
        }
      }
      
      res.json({ message: 'Tenant deleted successfully' });
    } catch (error) {
      console.error('Delete Tenant error:', error);
      res.status(500).json({ message: 'Failed to delete Tenant' });
    }
  });

  // Payment routes
  app.get('/api/payments', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { status, tenantId, lotId, type } = req.query;
      
      // For managers, filter by their assigned parks
      let payments;
      if (req.user!.role === 'MANAGER') {
        const assignments = await storage.getManagerAssignments(req.user!.id);
        const parkIds = assignments.map(a => a.parkId);
        
        if (parkIds.length === 0) {
          return res.json({ payments: [] });
        }
        
        // Get payments with Tenant info and filter by manager's parks
        const allPayments = await storage.getPaymentsWithTenantInfo({
          status: status as string
        });
        
        payments = allPayments.filter(payment => 
          payment.park && parkIds.includes(payment.park.id)
        );
      } else {
        // Admin can see all payments
        payments = await storage.getPaymentsWithTenantInfo({
          status: status as string
        });
      }
      
      res.json({ payments });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.get('/api/tenants/:tenantId/payments', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      
      // Verify Tenant exists and user has access
      const Tenant = await storage.getTenant(tenantId);
      if (!Tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // For managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      const payments = await storage.getPayments({ tenantId });
      res.json({ payments });
    } catch (error) {
      console.error('Get Tenant payments error:', error);
      res.status(500).json({ message: 'Failed to fetch Tenant payments' });
    }
  });

  app.post('/api/payments', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentData = req.body;

      // Verify Tenant exists and user has access
      const Tenant = await storage.getTenant(paymentData.tenantId);
      if (!Tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // For managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // Ensure lotId matches Tenant's lot
      paymentData.lotId = Tenant.lotId;

      const payment = await storage.createPayment(paymentData);
      res.status(201).json({ payment });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ message: 'Failed to create payment' });
    }
  });

  app.patch('/api/payments/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const paymentId = req.params.id;
      const updates = req.body;

      const existingPayment = await storage.getPayment(paymentId);
      if (!existingPayment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      // For managers, check if they have access to this payment's lot
      if (req.user!.role === 'MANAGER') {
        const lot = await storage.getLot(existingPayment.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this payment' });
        }
      }

      const payment = await storage.updatePayment(paymentId, updates);
      res.json({ payment });
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({ message: 'Failed to update payment' });
    }
  });

  app.delete('/api/payments/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
      const paymentId = req.params.id;
      
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        return res.status(404).json({ message: 'Payment not found' });
      }

      await storage.deletePayment(paymentId);
      res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
      console.error('Delete payment error:', error);
      res.status(500).json({ message: 'Failed to delete payment' });
    }
  });

  // Admin/Manager endpoint for full showing details (for lot history)
  app.get('/api/lots/:id/showings/full', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const lotId = req.params.id;
      
      // Get the lot to verify it exists and check permissions
      const lot = await storage.getLot(lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }

      // For managers, check if they have access to this lot's park
      if (req.user!.role === 'MANAGER') {
        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this lot' });
        }
      }

      // Get full showing details with manager information
      const showings = await storage.getShowings({ lotId });
      
      // Enrich with manager details
      const enrichedShowings = await Promise.all(
        showings.map(async (showing) => {
          const manager = await storage.getUser(showing.managerId);
          return {
            ...showing,
            manager: manager ? {
              fullName: manager.fullName,
              email: manager.email
            } : null
          };
        })
      );
      
      res.json({ showings: enrichedShowings });
    } catch (error) {
      console.error('Get full showings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Public booking endpoint
  app.post('/api/lots/:id/book', async (req, res) => {
    try {
      const lotId = req.params.id;
      const bookingData = bookingSchema.parse(req.body);
      
      const lotsWithPark = await storage.getLotsWithParkInfo({ 
        parkId: undefined, 
        includeInactive: true 
      });
      const lot = lotsWithPark.find(l => l.id === lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }

      // Get assigned manager and verify they are active
      const assignments = await storage.getManagerAssignments(undefined, lot.parkId);
      if (assignments.length === 0) {
        return res.status(400).json({ message: 'No manager assigned to this park' });
      }
      
      const managerId = assignments[0].userId;
      
      // Verify the assigned manager is active
      const manager = await storage.getUser(managerId);
      if (!manager || !manager.isActive) {
        return res.status(400).json({ message: 'No active manager available for this park' });
      }
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
            description: `Property showing for ${lot.park.name} - Lot ${lot.nameOrNumber}\n\nClient: ${bookingData.clientName}\nEmail: ${bookingData.clientEmail}\nPhone: ${bookingData.clientPhone || 'N/A'}`,
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
      } catch (error: any) {
        console.error('Calendar sync error:', error);
        
        // Check if this is a calendar conflict error (race condition)
        if (error.message === 'CALENDAR_CONFLICT') {
          // This means the manager created an event in their calendar after our initial check
          // Delete the showing we just created and return a conflict error
          await storage.deleteShowing(showing.id);
          return res.status(409).json({ 
            message: 'Time slot is no longer available - the manager has scheduled another event. Please select a different time.' 
          });
        }
        
        // For other calendar errors, mark as sync error but keep the booking
        calendarSyncError = true;
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
            // Fetch lot with park information for proper description
            const lotsWithPark = await storage.getLotsWithParkInfo({ includeInactive: true });
            const lotWithPark = lotsWithPark.find(l => l.id === updatedShowing.lotId);
            const lotDescription = lotWithPark 
              ? `${lotWithPark.park.name} - Lot ${lotWithPark.nameOrNumber}`
              : `lot ${updatedShowing.lotId}`;
            
            const event = {
              summary: `Property Showing - ${updatedShowing.clientName}`,
              description: `Property showing for ${lotDescription}\n\nClient: ${updatedShowing.clientName}\nEmail: ${updatedShowing.clientEmail}\nPhone: ${updatedShowing.clientPhone}`,
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
  app.delete('/api/photos/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get photo information to check permissions
      const photo = await storage.getPhoto(req.params.id);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      // Check permissions based on entity type
      if (photo.entityType === 'LOT') {
        // For lots, allow both admins and managers with lot access
        if (req.user?.role === 'ADMIN') {
          // Admin can delete any lot photo
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this lot
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company and park photos, only admins can delete
        if (req.user?.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Admin access required' });
        }
      }

      // Delete the file from filesystem
      try {
        const filePath = path.join(process.cwd(), photo.urlOrPath.replace(/^\//, ''));
        await fs.unlink(filePath);
      } catch (fileError) {
        console.error('Failed to delete file:', fileError);
        // Continue with DB deletion even if file deletion fails
      }

      await storage.deletePhoto(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete photo error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update individual photo
  app.patch('/api/photos/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { caption } = req.body;
      console.log('Update photo request:', { photoId: req.params.id, caption, body: req.body });
      
      // Get the photo to check permissions
      const photo = await storage.getPhoto(req.params.id);
      console.log('Found photo:', photo);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      // Check permissions based on entity type
      if (photo.entityType === 'LOT') {
        // For lots, allow both admins and managers with lot access
        if (req.user?.role === 'ADMIN') {
          // Admin can update any lot photo
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this lot
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (photo.entityType === 'PARK') {
        // For park photos, allow admins and managers with park access
        if (req.user?.role === 'ADMIN') {
          // Admin can update any park photo
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this park
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === photo.entityId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company photos, only admins can update
        if (req.user?.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Admin access required' });
        }
      }

      console.log('Updating photo with caption:', caption);
      const updatedPhoto = await storage.updatePhoto(req.params.id, { caption });
      console.log('Updated photo:', updatedPhoto);
      res.json(updatedPhoto);
    } catch (error) {
      console.error('Update photo error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Photo reordering route
  app.patch('/api/photos/reorder', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { entityType, entityId, photoOrders } = req.body;

      if (!entityType || !entityId || !Array.isArray(photoOrders)) {
        return res.status(400).json({ message: 'Missing required fields: entityType, entityId, photoOrders' });
      }

      // Validate entityType
      if (!['COMPANY', 'PARK', 'LOT'].includes(entityType)) {
        return res.status(400).json({ message: 'Invalid entityType. Must be COMPANY, PARK, or LOT' });
      }

      // Check permissions based on entity type
      if (entityType === 'LOT') {
        // For lots, allow both admins and managers with lot access
        if (req.user?.role === 'ADMIN') {
          // Admin can reorder any lot photos
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this lot
          const lot = await storage.getLotAny(entityId);
          if (!lot) {
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (entityType === 'PARK') {
        // For park photos, allow admins and managers with park access
        if (req.user?.role === 'ADMIN') {
          // Admin can reorder any park photos
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this park
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === entityId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company photos, only admins can reorder
        if (req.user?.role !== 'ADMIN') {
          return res.status(403).json({ message: 'Admin access required' });
        }
      }

      // Validate photoOrders array
      for (const item of photoOrders) {
        if (!item.id || typeof item.sortOrder !== 'number') {
          return res.status(400).json({ message: 'Each item in photoOrders must have id and sortOrder' });
        }
      }

      // Reorder photos
      await storage.reorderPhotos(entityType, entityId, photoOrders);
      
      // Return updated photos
      const updatedPhotos = await storage.getPhotos(entityType, entityId);
      res.json(updatedPhotos);
    } catch (error) {
      console.error('Reorder photos error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Tenant routes
  app.get('/api/tenant/me', authenticateToken, requireRole('TENANT'), async (req: AuthRequest, res) => {
    try {
      const userWithTenant = await storage.getUserWithTenant(req.user!.id);
      if (!userWithTenant || !userWithTenant.tenant) {
        return res.status(404).json({ message: 'Tenant information not found' });
      }
      
      const tenant = userWithTenant.tenant;
      const lot = await storage.getLot(tenant.lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Associated lot not found' });
      }
      
      const park = await storage.getPark(lot.parkId);
      if (!park) {
        return res.status(404).json({ message: 'Associated park not found' });
      }
      
      res.json({
        ...tenant,
        lot: {
          ...lot,
          park
        }
      });
    } catch (error) {
      console.error('Get tenant info error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/tenant/payments', authenticateToken, requireRole('TENANT'), async (req: AuthRequest, res) => {
    try {
      const userWithTenant = await storage.getUserWithTenant(req.user!.id);
      if (!userWithTenant || !userWithTenant.tenant) {
        return res.status(404).json({ message: 'Tenant information not found' });
      }
      
      const payments = await storage.getPayments({ tenantId: userWithTenant.tenant.id });
      res.json({ payments });
    } catch (error) {
      console.error('Get tenant payments error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/tenant/payments', authenticateToken, requireRole('TENANT'), upload.single('paymentProof'), async (req: AuthRequest, res) => {
    try {
      const userWithTenant = await storage.getUserWithTenant(req.user!.id);
      if (!userWithTenant || !userWithTenant.tenant) {
        return res.status(404).json({ message: 'Tenant information not found' });
      }
      const tenant = userWithTenant.tenant;
      
      const { type, amount, description, notes } = req.body;
      
      if (!type || !amount) {
        return res.status(400).json({ message: 'Payment type and amount are required' });
      }
      
      const paymentData = {
        tenantId: tenant.id,
        lotId: tenant.lotId,
        type,
        amount: parseFloat(amount),
        dueDate: new Date(), // Set to current date for tenant-submitted payments
        status: 'PENDING' as const, // Tenant payments start as pending
        description: description || null,
        notes: notes || null
      };
      
      const payment = await storage.createPayment(paymentData);
      
      // TODO: Handle payment proof file upload if provided
      if (req.file) {
        // Store file reference in payment notes or separate attachment system
        await storage.updatePayment(payment.id, {
          notes: `${payment.notes || ''}\nPayment proof uploaded: ${req.file.filename}`
        });
      }
      
      res.json({ payment });
    } catch (error) {
      console.error('Create tenant payment error:', error);
      res.status(500).json({ message: 'Failed to create payment' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
