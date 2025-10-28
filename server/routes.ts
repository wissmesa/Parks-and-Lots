import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import { promises as fs } from "fs";
import { readFileSync, unlinkSync, readdirSync, statSync, existsSync } from "fs";
import multer from "multer";
import jwt from 'jsonwebtoken';
import { storage } from "./storage";
import { db } from "./db";
import { invites, users } from "@shared/schema";
import { and, isNull, inArray, eq, ne } from "drizzle-orm";
import { 
  authenticateToken, 
  requireRole, 
  requireParkAccess, 
  requireLotAccess, 
  requireCompanyAccess,
  generateTokens, 
  hashPassword, 
  comparePassword,
  type AuthRequest 
} from "./auth";
import { calendarService } from "./calendar";
import { googleCalendarService } from "./google-calendar";
import { googleSheetsService } from "./google-sheets";
import { getLocationFromIP, extractIPFromRequest } from "./geolocation";
import { uploadToS3, deleteFromS3, extractS3KeyFromUrl } from "./s3";
import { sendLotCreationNotification, sendLotReactivationNotification } from "./email";
import { logCreation, logAuditEntries, compareObjects } from "./audit";

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

// Function to generate photo URLs - use relative paths for better compatibility
const getPhotoUrl = (req: Request, filename: string): string => {
  // Use relative paths that work in both development and production
  return `/static/uploads/${filename}`;
};

// Configure multer for file uploads (using memory storage for S3)
const upload = multer({
  storage: multer.memoryStorage(), // Guardar en memoria para subir a S3
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (aumentado porque optimizamos las imágenes)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Clean up old login logs on server startup
  try {
    await storage.cleanOldLoginLogs();
  } catch (error) {
    console.error('[Server] Failed to clean old login logs on startup:', error);
  }

  // Serve static files - ensure this is before any other middleware
  // Use a more explicit configuration for static file serving
  const staticOptions = {
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res: any, path: string) => {
      // Add CORS headers for static files
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // Ensure proper content type for images
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      } else if (path.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      }
    }
  };
  
  app.use('/static', express.static(path.join(process.cwd(), 'static'), staticOptions));

  // Health check
  app.get('/api/healthz', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Debug endpoint to test static file serving
  app.get('/api/debug/static', (req, res) => {
    const uploadsPath = path.join(process.cwd(), 'static/uploads');
    
    try {
      const files = readdirSync(uploadsPath);
      const fileInfo = files.map((filename: string) => {
        const filePath = path.join(uploadsPath, filename);
        const stats = statSync(filePath);
        return {
          filename,
          size: stats.size,
          url: `/static/uploads/${filename}`,
          exists: existsSync(filePath)
        };
      });
      
      res.json({
        uploadsPath,
        fileCount: files.length,
        files: fileInfo.slice(0, 5) // Show first 5 files
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to read uploads directory',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Serve photos from database
  app.get('/api/photos/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Find photo by filename in urlOrPath
      const photos = await storage.getPhotosByFilename(filename);
      if (!photos || photos.length === 0) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      const photo = photos[0];
      
      // Convert base64 back to buffer
      const imageBuffer = Buffer.from(photo.imageData || '', 'base64');
      
      // Set appropriate headers
      res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('Content-Length', imageBuffer.length);
      
      // Send the image data
      res.send(imageBuffer);
    } catch (error) {
      console.error('Error serving photo:', error);
      res.status(500).json({ message: 'Error serving photo' });
    }
  });

  // Download photo by ID endpoint
  app.get('/api/photos/:photoId/download', authenticateToken, async (req, res) => {
    try {
      const photoId = req.params.photoId;
      
      // Get photo from database
      const photo = await storage.getPhoto(photoId);
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      // If photo has imageData (base64), serve it directly
      if (photo.imageData) {
        const imageBuffer = Buffer.from(photo.imageData, 'base64');
        res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
        res.setHeader('Content-Disposition', 'attachment');
        res.setHeader('Content-Length', imageBuffer.length);
        return res.send(imageBuffer);
      }

      // If photo is stored in local filesystem
      if (photo.urlOrPath && photo.urlOrPath.startsWith('/')) {
        const filePath = path.join(process.cwd(), 'static', photo.urlOrPath);
        if (existsSync(filePath)) {
          res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
          res.setHeader('Content-Disposition', 'attachment');
          return res.sendFile(filePath);
        }
      }

      // If photo is on S3 or external URL
      if (photo.urlOrPath && (photo.urlOrPath.startsWith('http://') || photo.urlOrPath.startsWith('https://'))) {
        // Fetch from S3/external URL and pipe to response
        const https = await import('https');
        const http = await import('http');
        const protocol = photo.urlOrPath.startsWith('https') ? https : http;
        
        protocol.get(photo.urlOrPath, (imageRes) => {
          res.setHeader('Content-Type', photo.mimeType || 'image/jpeg');
          res.setHeader('Content-Disposition', 'attachment');
          imageRes.pipe(res);
        }).on('error', (error) => {
          console.error('Error fetching photo from URL:', error);
          res.status(500).json({ message: 'Failed to fetch photo' });
        });
        return;
      }

      res.status(404).json({ message: 'Photo file not found' });
    } catch (error) {
      console.error('Error downloading photo:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


  // Admin Stats Endpoint
  app.get('/api/admin/stats', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
  app.get('/api/admin/recent-bookings', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
  app.get('/api/admin/managers', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const managers = await storage.getUsers({ role: 'MANAGER' });
      const companyManagers = await storage.getUsers({ role: 'ADMIN' });
      // Combine and re-sort alphabetically by fullName
      const allManagers = [...managers, ...companyManagers].sort((a, b) => 
        (a.fullName || '').localeCompare(b.fullName || '')
      );
      res.json(allManagers);
    } catch (error) {
      console.error('Managers list error:', error);
      res.status(500).json({ message: 'Failed to fetch managers' });
    }
  });

  // Manager enable/disable
  app.patch('/api/admin/managers/:id/toggle-active', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const manager = await storage.getUser(req.params.id);
      if (!manager || (manager.role !== 'MANAGER' && manager.role !== 'ADMIN')) {
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
  app.patch('/api/admin/managers/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const manager = await storage.getUser(req.params.id);
      if (!manager || (manager.role !== 'MANAGER' && manager.role !== 'ADMIN')) {
        return res.status(404).json({ message: 'Manager not found' });
      }
      
      // Allow updating fullName and/or companyId
      const { fullName, companyId } = req.body;
      
      const updateData: any = {};
      
      // Update fullName if provided
      if (fullName !== undefined) {
        if (typeof fullName !== 'string' || fullName.trim() === '') {
          return res.status(400).json({ message: 'Full name cannot be empty' });
        }
        updateData.fullName = fullName.trim();
      }
      
      // Update companyId if provided (allowed for both MANAGER and ADMIN roles)
      if (companyId !== undefined) {
        updateData.companyId = companyId;
      }
      
      // Ensure at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }
      
      const updatedManager = await storage.updateUser(req.params.id, updateData);
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

  // Company Manager API Endpoints
  app.get('/api/company-manager/parks', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const result = await storage.getParksByCompany(req.user!.companyId);
      const parks = result?.parks || [];
      
      // Parse amenities from JSON strings back to objects
      if (Array.isArray(parks)) {
        parks.forEach((park: any) => {
          if (park.amenities && Array.isArray(park.amenities)) {
            park.amenities = park.amenities.map((amenity: any) => {
              if (!amenity) return amenity;
              try {
                if (typeof amenity === 'string' && amenity.trim().startsWith('{')) {
                  return JSON.parse(amenity);
                }
                return amenity;
              } catch (e) {
                console.error('Failed to parse amenity:', amenity, e);
                return amenity;
              }
            });
          }
        });
      }
      
      res.json({ parks });
    } catch (error) {
      console.error('Company manager parks error:', error);
      res.status(500).json({ message: 'Failed to fetch parks' });
    }
  });

  app.get('/api/company-manager/managers', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      // Get all managers (both MANAGER and ADMIN) for this company
      const managers = await storage.getUsers({ role: 'MANAGER' });
      const companyManagers = await storage.getUsers({ role: 'ADMIN' });
      
      // Filter managers by company (for MANAGER role, check their park assignments)
      const companyManagersList = companyManagers.filter(manager => manager.companyId === req.user!.companyId);
      
      // For regular managers, check if they have park assignments in this company
      const companyParksResponse = await storage.getParksByCompany(req.user!.companyId);
      const companyParks = companyParksResponse.parks || [];
      const companyParkIds = companyParks.map((park: any) => park.id);
      
      const companyManagersWithParks = [];
      for (const manager of managers) {
        const assignments = await storage.getManagerAssignments(manager.id);
        const hasCompanyPark = assignments.some(assignment => companyParkIds.includes(assignment.parkId));
        if (hasCompanyPark) {
          // Get park names for this manager
          const managerParks = assignments
            .filter(assignment => companyParkIds.includes(assignment.parkId))
            .map(assignment => ({
              id: assignment.parkId,
              name: assignment.parkName
            }));
          
          companyManagersWithParks.push({
            ...manager,
            assignedParks: managerParks,
            role: 'MANAGER'
          });
        }
      }
      
      // Add company managers
      const allManagers = [
        ...companyManagersWithParks,
        ...companyManagersList.map(manager => ({
          ...manager,
          assignedParks: [],
          role: 'ADMIN'
        }))
      ];
      
      res.json({ managers: allManagers });
    } catch (error) {
      console.error('Company managers error:', error);
      res.status(500).json({ message: 'Failed to fetch managers' });
    }
  });

  app.get('/api/company-manager/lots', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const lots = await storage.getLotsByCompany(req.user!.companyId);
      res.json(lots);
    } catch (error) {
      console.error('Company manager lots error:', error);
      res.status(500).json({ message: 'Failed to fetch lots' });
    }
  });

  app.post('/api/company-manager/lots', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      // Verify company manager has access to the park
      const park = await storage.getPark(req.body.parkId);
      if (!park || park.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'You can only create lots in your company parks' });
      }
      
      const lotData = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(lotData);
      
      // Send notification email (don't fail the request if email fails)
      try {
        await sendLotCreationNotification(
          {
            id: lot.id,
            nameOrNumber: lot.nameOrNumber,
            parkName: park.name,
            status: lot.status || [],
            description: lot.description || undefined,
            bedrooms: lot.bedrooms,
            bathrooms: lot.bathrooms,
          },
          req.user!.fullName
        );
      } catch (emailError) {
        console.error('Failed to send lot creation notification email:', emailError);
      }
      
      // Attempt to export to Google Sheets (don't fail the request if export fails)
      let sheetsExportSuccess = false;
      let sheetsExportError: string | null = null;
      let spreadsheetUrl: string | null = null;
      
      try {
        const userId = req.user!.id;
        // Check if user has Google Sheets connected
        const oauthAccount = await storage.getOAuthAccount(userId, 'google-sheets');
        
        if (!oauthAccount) {
          sheetsExportError = 'Please connect your Google account in settings.';
        } else if (!oauthAccount.spreadsheetId) {
          sheetsExportError = 'Please link a spreadsheet in settings.';
        } else {
          // Prepare lot data with park information
          const lotWithPark = {
            ...lot,
            park: park
          };
          
          const exportResult = await googleSheetsService.exportLotToSheet(userId, lotWithPark);
          sheetsExportSuccess = true;
          spreadsheetUrl = exportResult.spreadsheetUrl;
        }
      } catch (exportError: unknown) {
        console.error('Failed to export lot to Google Sheets:', exportError);
        sheetsExportError = exportError instanceof Error ? exportError.message : 'Unknown export error';
      }
      
      res.status(201).json({
        ...lot,
        sheetsExportSuccess,
        sheetsExportError,
        spreadsheetUrl
      });
    } catch (error: unknown) {
      console.error('Create lot error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
      }
      res.status(400).json({ message: 'Invalid lot data', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch('/api/company-manager/lots/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      console.log('=== COMPANY MANAGER LOT UPDATE DEBUG ===');
      console.log('Lot ID:', req.params.id);
      console.log('Raw request body:', JSON.stringify(req.body, null, 2));
      
      // Verify company manager owns the lot (through company park)
      const lot = await storage.getLotAny(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      // Store original isActive status to detect reactivation
      const wasInactive = lot.isActive === false;
      
      const park = await storage.getPark(lot.parkId);
      if (!park || park.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'You can only update lots in your company parks' });
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
      
      // Check if lot was reactivated (changed from inactive to active)
      console.log('🔍 [COMPANY MANAGER] Reactivation check:', { 
        wasInactive, 
        newIsActive: validation.data.isActive,
        isBeingReactivated: wasInactive && validation.data.isActive === true 
      });
      const isBeingReactivated = wasInactive && validation.data.isActive === true;
      
      if (isBeingReactivated) {
        console.log('✅ [COMPANY MANAGER] Lot is being reactivated, sending email...');
        // Send reactivation notification (don't fail the request if email fails)
        try {
          await sendLotReactivationNotification(
            {
              id: updatedLot.id,
              nameOrNumber: updatedLot.nameOrNumber,
              parkName: park.name,
              status: updatedLot.status || [],
              description: updatedLot.description || undefined,
              bedrooms: updatedLot.bedrooms,
              bathrooms: updatedLot.bathrooms,
            },
            req.user?.fullName || 'Sistema'
          );
        } catch (emailError) {
          console.error('Failed to send lot reactivation notification email:', emailError);
        }
      }
      
      res.json(updatedLot);
    } catch (error) {
      console.error('Update lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.delete('/api/company-manager/lots/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      // Verify company manager owns the lot (through company park)
      const lot = await storage.getLotAny(req.params.id);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      
      const park = await storage.getPark(lot.parkId);
      if (!park || park.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'You can only delete lots in your company parks' });
      }
      
      await storage.deleteLot(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete lot error:', error);
      res.status(500).json({ message: 'Failed to delete lot' });
    }
  });

  app.post('/api/company-manager/lots/bulk', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const { lots } = req.body;
      
      if (!Array.isArray(lots) || lots.length === 0) {
        return res.status(400).json({ message: 'Lots array is required' });
      }

      if (lots.length > 1000) {
        return res.status(400).json({ message: 'Maximum 1000 lots per upload' });
      }

      // Get company parks
      const companyParks = await storage.getParksByCompany(req.user!.companyId);
      if (companyParks.parks.length === 0) {
        return res.status(403).json({ message: 'Company has no parks' });
      }

      // Handle single vs multi-park scenarios
      const isMultiPark = companyParks.parks.length > 1;
      let defaultParkId: string | null = null;
      let assignedParkName = '';
      
      if (!isMultiPark) {
        // Single park - use automatic assignment
        defaultParkId = companyParks.parks[0].id;
        assignedParkName = companyParks.parks[0].name;
      }

      const results: { successful: any[], failed: any[], warnings?: any[], assignedPark?: string, multiPark?: boolean, assignedParks?: any[] } = { 
        successful: [], 
        failed: [],
        warnings: [],
        assignedPark: assignedParkName,
        multiPark: isMultiPark,
        assignedParks: companyParks.parks.map(p => ({ id: p.id, name: p.name }))
      };

      for (let i = 0; i < lots.length; i++) {
        const lotData = lots[i];
        const rowNumber = i + 1;
        
        try {
          // Auto-assign to single park if only one park
          if (defaultParkId && !lotData.parkId && !lotData.parkName) {
            lotData.parkId = defaultParkId;
          }
          
          // Resolve park name to park ID if provided (prioritized over parkId)
          if (lotData.parkName && String(lotData.parkName).trim()) {
            const parkName = String(lotData.parkName).trim();
            const matchingPark = companyParks.parks.find(p => 
              p.name.toLowerCase() === parkName.toLowerCase()
            );
            if (matchingPark) {
              lotData.parkId = matchingPark.id;
            } else {
              const availableParks = companyParks.parks.map(p => p.name).join(', ');
              results.failed.push({
                row: rowNumber,
                ...lotData,
                error: `Park '${parkName}' not found in company parks. Available parks: ${availableParks}`
              });
              continue;
            }
          }
          
          // Validate park ID if provided
          if (lotData.parkId) {
            const park = companyParks.parks.find(p => p.id === lotData.parkId);
            if (!park) {
              results.failed.push({
                row: rowNumber,
                ...lotData,
                error: `Park ${lotData.parkId} not found in your company parks`
              });
              continue;
            }
          }
          // Note: Lots without park assignment are now allowed and can be assigned later

          const parsedLot = insertLotSchema.parse(lotData);
          const createdLot = await storage.createLot(parsedLot);
          results.successful.push(createdLot);
          
          // Add warning if lot was created without park assignment
          if (!createdLot.parkId) {
            results.warnings!.push({
              row: rowNumber,
              lotName: createdLot.nameOrNumber,
              message: `Lot '${createdLot.nameOrNumber}' was created without park assignment. You can assign it to a park later.`
            });
          }
        } catch (error) {
          console.error('Bulk lot creation error for lot:', lotData, error);
          results.failed.push({
            row: rowNumber,
            ...lotData,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Bulk lot creation error:', error);
      res.status(500).json({ message: 'Failed to create lots' });
    }
  });

  app.get('/api/company-manager/showings/today', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const showings = await storage.getShowingsByCompany(req.user!.companyId, 'today');
      res.json(showings);
    } catch (error) {
      console.error('Company manager today showings error:', error);
      res.status(500).json({ message: 'Failed to fetch today showings' });
    }
  });

  app.get('/api/company-manager/showings/this-week', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const showings = await storage.getShowingsByCompany(req.user!.companyId, 'this-week');
      res.json(showings);
    } catch (error) {
      console.error('Company manager this week showings error:', error);
      res.status(500).json({ message: 'Failed to fetch this week showings' });
    }
  });

  app.get('/api/company-manager/showings/this-month', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const showings = await storage.getShowingsByCompany(req.user!.companyId, 'this-month');
      res.json(showings);
    } catch (error) {
      console.error('Company manager this month showings error:', error);
      res.status(500).json({ message: 'Failed to fetch this month showings' });
    }
  });

  app.get('/api/company-manager/stats', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }
      
      const stats = await storage.getCompanyManagerStats(req.user!.companyId);
      res.json(stats);
    } catch (error) {
      console.error('Company manager stats error:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  app.get('/api/manager/showings/today', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get database showings for ID mapping
      const dbShowings = await storage.getShowings({ managerId: req.user!.id });
      const todayDbShowings = dbShowings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfDay && showingDate < endOfDay;
      });

      // Initialize with empty array - will be populated from calendar if connected
      let todayShowings: any[] = [];

      try {
        const isConnected = await googleCalendarService.isCalendarConnected(req.user!.id);
        
        if (isConnected) {
          // Get calendar events for the same time range
          const calendarEvents = await googleCalendarService.getUserCalendarEvents(
            req.user!.id, 
            startOfDay, 
            endOfDay
          );

          // Filter property showing events (including completed ones)
          const propertyShowingEvents = calendarEvents.filter(event => 
            event.id && event.summary && (event.summary.includes('Property Showing') || event.summary.includes('COMPLETED'))
          );

          // Always use calendar as the source of truth when connected
          // Map calendar events to showing objects
          todayShowings = propertyShowingEvents.map(event => {
              const eventStart = new Date(event.start?.dateTime || event.start?.date!);
              
              // Find the corresponding database showing by calendar event ID
              const dbShowing = todayDbShowings.find(s => s.calendarEventId === event.id);
              
              // Extract contact information from event description
              let clientEmail = '';
              let clientPhone = '';
              
              if (event.description) {
                // Look for email pattern in description
                const emailMatch = event.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                if (emailMatch) {
                  clientEmail = emailMatch[1];
                }
                
                // Look for phone pattern in description (various formats)
                const phoneMatch = event.description.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
                if (phoneMatch) {
                  // Reconstruct phone number
                  const areaCode = phoneMatch[2];
                  const firstPart = phoneMatch[3];
                  const secondPart = phoneMatch[4];
                  clientPhone = `(${areaCode}) ${firstPart}-${secondPart}`;
                }
              }
              
              // Also check attendees for email information
              if (!clientEmail && event.attendees && event.attendees.length > 0) {
                const clientAttendee = event.attendees.find(attendee => 
                  attendee.email && !attendee.organizer && attendee.responseStatus !== 'declined'
                );
                if (clientAttendee?.email) {
                  clientEmail = clientAttendee.email;
                }
              }
              
              return {
                id: dbShowing?.id || event.id, // Use database showing ID if available, fallback to event ID
                startDt: eventStart.toISOString(),
                endDt: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : new Date(eventStart.getTime() + 30 * 60 * 1000).toISOString(),
                status: event.summary?.includes('COMPLETED') ? 'COMPLETED' : 'SCHEDULED',
                clientName: event.summary?.replace('COMPLETED - ', '').replace('Property Showing - ', '').split(' - ')[0] || 'Unknown',
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                calendarHtmlLink: event.htmlLink,
                calendarEventId: event.id, // Include the calendar event ID for reference
                lot: dbShowing?.lot || {
                  nameOrNumber: event.summary?.split(' - ')[1] || 'Unknown Lot',
                  park: {
                    name: 'Unknown Park'
                  }
                }
              };
            });
        } else {
          // Calendar not connected, use database showings
          todayShowings = todayDbShowings;
        }
      } catch (calendarError) {
        console.log('Calendar fetch failed, using database data:', calendarError);
        // Fallback to database data if calendar fails
        todayShowings = todayDbShowings;
      }

      res.json(todayShowings);
    } catch (error) {
      console.error('Today showings error:', error);
      res.status(500).json({ message: 'Failed to fetch today showings' });
    }
  });

  app.get('/api/manager/showings/this-week', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of this week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7); // End of this week
      endOfWeek.setHours(0, 0, 0, 0);

      // Get database showings for ID mapping
      const dbShowings = await storage.getShowings({ managerId: req.user!.id });
      const thisWeekDbShowings = dbShowings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfWeek && showingDate < endOfWeek;
      });

      // Initialize with empty array - will be populated from calendar if connected
      let thisWeekShowings: any[] = [];

      try {
        const isConnected = await googleCalendarService.isCalendarConnected(req.user!.id);
        
        if (isConnected) {
          // Get calendar events for the same time range
          const calendarEvents = await googleCalendarService.getUserCalendarEvents(
            req.user!.id, 
            startOfWeek, 
            endOfWeek
          );

          // Filter property showing events (including completed ones)
          const propertyShowingEvents = calendarEvents.filter(event => 
            event.id && event.summary && (event.summary.includes('Property Showing') || event.summary.includes('COMPLETED'))
          );

          // Always use calendar as the source of truth when connected
          thisWeekShowings = propertyShowingEvents.map(event => {
            const eventStart = new Date(event.start?.dateTime || event.start?.date!);
            const dbShowing = thisWeekDbShowings.find(s => s.calendarEventId === event.id);
            
            let clientEmail = '';
            let clientPhone = '';
            
            if (event.description) {
              const emailMatch = event.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              if (emailMatch) clientEmail = emailMatch[1];
              
              const phoneMatch = event.description.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
              if (phoneMatch) {
                clientPhone = `(${phoneMatch[2]}) ${phoneMatch[3]}-${phoneMatch[4]}`;
              }
            }
            
            if (!clientEmail && event.attendees && event.attendees.length > 0) {
              const clientAttendee = event.attendees.find(attendee => 
                attendee.email && !attendee.organizer && attendee.responseStatus !== 'declined'
              );
              if (clientAttendee?.email) clientEmail = clientAttendee.email;
            }
            
            return {
              id: dbShowing?.id || event.id,
              startDt: eventStart.toISOString(),
              endDt: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : new Date(eventStart.getTime() + 30 * 60 * 1000).toISOString(),
              status: event.summary?.includes('COMPLETED') ? 'COMPLETED' : 'SCHEDULED',
              clientName: event.summary?.replace('COMPLETED - ', '').replace('Property Showing - ', '').split(' - ')[0] || 'Unknown',
              clientEmail: clientEmail,
              clientPhone: clientPhone,
              calendarHtmlLink: event.htmlLink,
              calendarEventId: event.id,
              lot: dbShowing?.lot || {
                nameOrNumber: event.summary?.split(' - ')[1] || 'Unknown Lot',
                park: { name: 'Unknown Park' }
              }
            };
          });
        } else {
          // Calendar not connected, use database showings
          thisWeekShowings = thisWeekDbShowings;
        }
      } catch (calendarError) {
        console.log('Calendar fetch failed, using database data:', calendarError);
        thisWeekShowings = thisWeekDbShowings;
      }

      res.json(thisWeekShowings);
    } catch (error) {
      console.error('This week showings error:', error);
      res.status(500).json({ message: 'Failed to fetch this week showings' });
    }
  });

  app.get('/api/manager/showings/this-month', authenticateToken, requireRole('MANAGER'), async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      endOfMonth.setHours(0, 0, 0, 0);

      // Get database showings for ID mapping
      const dbShowings = await storage.getShowings({ managerId: req.user!.id });
      const thisMonthDbShowings = dbShowings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfMonth && showingDate < endOfMonth;
      });

      // Initialize with empty array - will be populated from calendar if connected
      let thisMonthShowings: any[] = [];

      try {
        const isConnected = await googleCalendarService.isCalendarConnected(req.user!.id);
        
        if (isConnected) {
          // Get calendar events for the same time range
          const calendarEvents = await googleCalendarService.getUserCalendarEvents(
            req.user!.id, 
            startOfMonth, 
            endOfMonth
          );

          // Filter property showing events (including completed ones)
          const propertyShowingEvents = calendarEvents.filter(event => 
            event.id && event.summary && (event.summary.includes('Property Showing') || event.summary.includes('COMPLETED'))
          );

          // Always use calendar as the source of truth when connected
          thisMonthShowings = propertyShowingEvents.map(event => {
            const eventStart = new Date(event.start?.dateTime || event.start?.date!);
            const dbShowing = thisMonthDbShowings.find(s => s.calendarEventId === event.id);
            
            let clientEmail = '';
            let clientPhone = '';
            
            if (event.description) {
              const emailMatch = event.description.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
              if (emailMatch) clientEmail = emailMatch[1];
              
              const phoneMatch = event.description.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
              if (phoneMatch) {
                clientPhone = `(${phoneMatch[2]}) ${phoneMatch[3]}-${phoneMatch[4]}`;
              }
            }
            
            if (!clientEmail && event.attendees && event.attendees.length > 0) {
              const clientAttendee = event.attendees.find(attendee => 
                attendee.email && !attendee.organizer && attendee.responseStatus !== 'declined'
              );
              if (clientAttendee?.email) clientEmail = clientAttendee.email;
            }
            
            return {
              id: dbShowing?.id || event.id,
              startDt: eventStart.toISOString(),
              endDt: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : new Date(eventStart.getTime() + 30 * 60 * 1000).toISOString(),
              status: event.summary?.includes('COMPLETED') ? 'COMPLETED' : 'SCHEDULED',
              clientName: event.summary?.replace('COMPLETED - ', '').replace('Property Showing - ', '').split(' - ')[0] || 'Unknown',
              clientEmail: clientEmail,
              clientPhone: clientPhone,
              calendarHtmlLink: event.htmlLink,
              calendarEventId: event.id,
              lot: dbShowing?.lot || {
                nameOrNumber: event.summary?.split(' - ')[1] || 'Unknown Lot',
                park: { name: 'Unknown Park' }
              }
            };
          });
        } else {
          // Calendar not connected, use database showings
          thisMonthShowings = thisMonthDbShowings;
        }
      } catch (calendarError) {
        console.log('Calendar fetch failed, using database data:', calendarError);
        thisMonthShowings = thisMonthDbShowings;
      }

      res.json(thisMonthShowings);
    } catch (error) {
      console.error('This month showings error:', error);
      res.status(500).json({ message: 'Failed to fetch this month showings' });
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

      // Use database as primary source for consistency
      let scheduledCount = showings.filter(showing => 
        showing.status === 'SCHEDULED' || showing.status === 'CONFIRMED'
      ).length;

      let todayShowings = showings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfDay && showingDate < endOfDay;
      }).length;

      let thisWeekShowings = showings.filter(showing => {
        const showingDate = new Date(showing.startDt);
        return showingDate >= startOfWeek && showingDate <= endOfWeek;
      }).length;


      // Initialize counts
      let completedCount = 0;
      let cancelledCount = 0;

      // Use Google Calendar as primary source if available
      try {
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

          // Filter property showing events (including completed ones)
          const propertyShowingEvents = calendarEvents.filter(event => 
            event.id && event.summary && (event.summary.includes('Property Showing') || event.summary.includes('COMPLETED'))
          );

          // Use calendar events as the source of truth
          // Count scheduled showings (future, non-completed events)
          scheduledCount = propertyShowingEvents.filter(event => {
            if (!event.start?.dateTime && !event.start?.date) return false;
            const eventStart = new Date(event.start.dateTime || event.start.date!);
            const isCompleted = event.summary?.includes('COMPLETED');
            return eventStart > today && !isCompleted;
          }).length;

          // Count completed showings (events with COMPLETED in title)
          completedCount = propertyShowingEvents.filter(event => 
            event.summary?.includes('COMPLETED')
          ).length;

          // Note: Cancelled events are deleted from calendar, so we get this from database
          cancelledCount = showings.filter(showing => showing.status === 'CANCELED').length;

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
          // Calendar not connected, use database as fallback
          completedCount = showings.filter(showing => showing.status === 'COMPLETED').length;
          cancelledCount = showings.filter(showing => showing.status === 'CANCELED').length;
        }
      } catch (calendarError) {
        console.log('Calendar verification failed, using database counts:', calendarError);
        // Use database counts if calendar fails
        completedCount = showings.filter(showing => showing.status === 'COMPLETED').length;
        cancelledCount = showings.filter(showing => showing.status === 'CANCELED').length;
      }

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
      
      // Get park name for notification
      const park = await storage.getPark(req.body.parkId);
      
      // Send notification email (don't fail the request if email fails)
      try {
        await sendLotCreationNotification(
          {
            id: lot.id,
            nameOrNumber: lot.nameOrNumber,
            parkName: park?.name,
            status: lot.status || [],
            description: lot.description || undefined,
            bedrooms: lot.bedrooms,
            bathrooms: lot.bathrooms,
          },
          req.user!.fullName
        );
      } catch (emailError) {
        console.error('Failed to send lot creation notification email:', emailError);
      }
      
      // Attempt to export to Google Sheets (don't fail the request if export fails)
      let sheetsExportSuccess = false;
      let sheetsExportError: string | null = null;
      let spreadsheetUrl: string | null = null;
      
      try {
        const userId = req.user!.id;
        // Check if user has Google Sheets connected
        const oauthAccount = await storage.getOAuthAccount(userId, 'google-sheets');
        
        if (!oauthAccount) {
          sheetsExportError = 'Please connect your Google account in settings.';
        } else if (!oauthAccount.spreadsheetId) {
          sheetsExportError = 'Please link a spreadsheet in settings.';
        } else {
          // Prepare lot data with park information
          const lotWithPark = {
            ...lot,
            park: park
          };
          
          const exportResult = await googleSheetsService.exportLotToSheet(userId, lotWithPark);
          sheetsExportSuccess = true;
          spreadsheetUrl = exportResult.spreadsheetUrl;
        }
      } catch (exportError: unknown) {
        console.error('Failed to export lot to Google Sheets:', exportError);
        sheetsExportError = exportError instanceof Error ? exportError.message : 'Unknown export error';
      }
      
      res.status(201).json({
        ...lot,
        sheetsExportSuccess,
        sheetsExportError,
        spreadsheetUrl
      });
    } catch (error: unknown) {
      console.error('Create lot error:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Request body:', JSON.stringify(req.body, null, 2));
      }
      res.status(400).json({ message: 'Invalid lot data', error: error instanceof Error ? error.message : 'Unknown error' });
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
      // Use getLotAny to allow updating hidden (isActive: false) lots
      const lot = await storage.getLotAny(req.params.id);
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
    const { email, password } = req.body;
    const ipAddress = extractIPFromRequest(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    try {
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isActive) {
        // Log failed login attempt
        try {
          const location = await getLocationFromIP(ipAddress);
          await storage.createLoginLog({
            userId: null,
            email: email,
            success: false,
            ipAddress: ipAddress,
            locationCity: location.city,
            locationRegion: location.region,
            locationCountry: location.country,
            userAgent: userAgent,
          });
        } catch (logError) {
          console.error('[Login] Failed to log failed login attempt:', logError);
        }
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await comparePassword(password, user.passwordHash);
      if (!isValidPassword) {
        // Log failed login attempt
        try {
          const location = await getLocationFromIP(ipAddress);
          await storage.createLoginLog({
            userId: user.id,
            email: email,
            success: false,
            ipAddress: ipAddress,
            locationCity: location.city,
            locationRegion: location.region,
            locationCountry: location.country,
            userAgent: userAgent,
          });
        } catch (logError) {
          console.error('[Login] Failed to log failed login attempt:', logError);
        }
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Log successful login
      try {
        const location = await getLocationFromIP(ipAddress);
        await storage.createLoginLog({
          userId: user.id,
          email: email,
          success: true,
          ipAddress: ipAddress,
          locationCity: location.city,
          locationRegion: location.region,
          locationCountry: location.country,
          userAgent: userAgent,
        });
      } catch (logError) {
        console.error('[Login] Failed to log successful login:', logError);
        // Continue with login even if logging fails
      }

      const tokens = generateTokens(user);
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName, 
          role: user.role,
          companyId: user.companyId
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
          role: user.role,
          companyId: user.companyId
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

  // Google Sheets OAuth routes
  app.get('/api/auth/google-sheets/connect', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      const state = `${user.id}:${randomBytes(16).toString('hex')}`;
      const authUrl = googleSheetsService.generateAuthUrl(state);
      
      res.json({ authUrl });
    } catch (error) {
      console.error('Google Sheets auth URL generation error:', error);
      res.status(500).json({ message: 'Failed to generate authorization URL' });
    }
  });

  app.get('/api/auth/google-sheets/callback', async (req, res) => {
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
      
      // Validate that the user exists and has appropriate role
      const user = await storage.getUser(stateUserId);
      if (!user || !['MHP_LORD', 'MANAGER', 'ADMIN'].includes(user.role)) {
        return res.status(403).send('Invalid user or insufficient permissions');
      }

      // Exchange code for tokens
      const tokens = await googleSheetsService.exchangeCodeForTokens(code as string);
      
      // Store tokens for the user from state
      await googleSheetsService.storeTokens(stateUserId, tokens);
      
      // Return success page that closes the popup
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google Sheets Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; background: #f8f9fa; }
            .success { color: #059669; font-size: 18px; margin-bottom: 20px; }
            .message { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="success">✅ Google Sheets Connected</div>
          <div class="message">You can now export lot data to Google Sheets. This window will close automatically.</div>
          <script>
            // Notify parent window that connection was successful
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_SHEETS_CONNECTED', success: true }, '*');
            }
            // Auto-close after 2 seconds
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Google Sheets OAuth callback error:', error);
      
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
              window.opener.postMessage({ type: 'GOOGLE_SHEETS_CONNECTED', success: false }, '*');
            }
            // Auto-close after 3 seconds
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `);
    }
  });

  app.get('/api/auth/google-sheets/status', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      const account = await storage.getOAuthAccount(user.id, 'google-sheets');
      
      // Check if we have an account and a valid access token
      let connected = false;
      if (account && account.accessToken) {
        // Verify we can actually get a valid access token (this will check expiry and refresh if needed)
        const validToken = await googleSheetsService.getValidAccessToken(user.id);
        connected = !!validToken;
      }
      
      res.json({ 
        connected,
        spreadsheetId: account?.spreadsheetId || null 
      });
    } catch (error) {
      console.error('Google Sheets status check error:', error);
      res.status(500).json({ message: 'Failed to check Google Sheets connection status' });
    }
  });

  app.post('/api/auth/google-sheets/set-spreadsheet', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      const { spreadsheetId } = req.body;
      
      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return res.status(400).json({ message: 'Spreadsheet ID is required' });
      }

      // Verify that user has Google Sheets connected first
      const account = await storage.getOAuthAccount(user.id, 'google-sheets');
      if (!account) {
        return res.status(400).json({ message: 'Please connect Google Sheets first' });
      }

      await googleSheetsService.setSpreadsheetId(user.id, spreadsheetId);
      res.json({ message: 'Spreadsheet ID saved successfully', spreadsheetId });
    } catch (error) {
      console.error('Set spreadsheet ID error:', error);
      res.status(500).json({ message: 'Failed to save spreadsheet ID' });
    }
  });

  app.post('/api/auth/google-sheets/disconnect', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req, res) => {
    try {
      const user = (req as AuthRequest).user!;
      await storage.deleteOAuthAccount(user.id, 'google-sheets');
      res.json({ message: 'Google Sheets disconnected successfully' });
    } catch (error) {
      console.error('Google Sheets disconnect error:', error);
      res.status(500).json({ message: 'Failed to disconnect Google Sheets' });
    }
  });

  // Export lot to Google Sheets
  app.post('/api/lots/:id/export-to-sheets', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req: AuthRequest, res) => {
    try {
      const lotId = req.params.id;
      const user = req.user!;
      
      // Get the lot data
      const lot = await storage.getLot(lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Lot not found' });
      }

      // Check if user has access to this lot
      if (user.role === 'MANAGER') {
        const assignments = await storage.getManagerAssignments(user.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'You do not have access to this lot' });
        }
      } else if (user.role === 'ADMIN') {
        const park = await storage.getPark(lot.parkId);
        const hasAccess = park && park.companyId === user.companyId;
        if (!hasAccess) {
          return res.status(403).json({ message: 'You do not have access to this lot' });
        }
      }

      // Get lot with park info for export
      const lotsWithParkInfo = await storage.getLotsWithParkInfo({ includeInactive: true });
      const lotWithPark = lotsWithParkInfo.find(l => l.id === lotId);
      
      if (!lotWithPark) {
        return res.status(404).json({ message: 'Lot details not found' });
      }

      // Export to Google Sheets
      const result = await googleSheetsService.exportLotToSheet(user.id, lotWithPark);
      
      res.json({
        message: 'Lot exported to Google Sheets successfully',
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl
      });
    } catch (error) {
      console.error('Export lot to Google Sheets error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export lot to Google Sheets';
      res.status(500).json({ message: errorMessage });
    }
  });

  // Export multiple lots to Google Sheets
  app.post('/api/lots/export-to-sheets', authenticateToken, requireRole(['MHP_LORD', 'MANAGER', 'ADMIN']), async (req: AuthRequest, res) => {
    try {
      const { lotIds } = req.body;
      const user = req.user!;
      
      if (!lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
        return res.status(400).json({ message: 'Lot IDs are required' });
      }

      // Get all lots with park info
      const lotsWithParkInfo = await storage.getLotsWithParkInfo({ includeInactive: true });
      
      // Filter and check access
      const lots = [];
      for (const lotId of lotIds) {
        const lot = await storage.getLot(lotId);
        const lotWithPark = lotsWithParkInfo.find(l => l.id === lotId);
        
        if (lot && lotWithPark) {
          // Check if user has access to this lot
          if (user.role === 'MANAGER') {
            const assignments = await storage.getManagerAssignments(user.id);
            const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
            if (hasAccess) {
              lots.push(lotWithPark);
            }
          } else if (user.role === 'ADMIN') {
            const park = await storage.getPark(lot.parkId);
            const hasAccess = park && park.companyId === user.companyId;
            if (hasAccess) {
              lots.push(lotWithPark);
            }
          } else {
            lots.push(lotWithPark);
          }
        }
      }

      if (lots.length === 0) {
        return res.status(404).json({ message: 'No accessible lots found' });
      }

      // Export to Google Sheets
      const result = await googleSheetsService.exportMultipleLotsToSheet(user.id, lots);
      
      res.json({
        message: `${lots.length} lots exported to Google Sheets successfully`,
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl
      });
    } catch (error) {
      console.error('Export lots to Google Sheets error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export lots to Google Sheets';
      res.status(500).json({ message: errorMessage });
    }
  });

  // Calendar sync endpoint - Admin only 
  app.post('/api/admin/sync-calendar', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
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
      phone: req.user!.phone,
      role: req.user!.role,
      tenantId: req.user!.tenantId,
      companyId: req.user!.companyId
    });
  });

  // Update current user's profile
  app.patch('/api/users/me/profile', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { fullName, email, phone } = req.body;

      // Validate the input
      const validation = insertUserSchema.partial().safeParse({ fullName, email, phone });
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validation.error.errors 
        });
      }

      // Check if email is being changed and if it's already taken
      if (email && email !== req.user!.email) {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, email), ne(users.id, userId)))
          .limit(1);

        if (existingUser) {
          return res.status(400).json({ 
            message: 'Email address is already in use by another account' 
          });
        }
      }

      // Update the user profile
      const updatedUser = await storage.updateUser(userId, {
        fullName: validation.data.fullName,
        email: validation.data.email,
        phone: validation.data.phone === '' ? null : validation.data.phone
      });

      // Emit real-time update event
      io.emit('user:updated', { userId, user: updatedUser });

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.role,
        tenantId: updatedUser.tenantId,
        companyId: updatedUser.companyId
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
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

  app.post('/api/users/:userId/link-tenant/:tenantId', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
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

  app.delete('/api/users/:userId/unlink-tenant', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
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
  app.get('/api/admin/tenant-users', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
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

  app.post('/api/auth/invites', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
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
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: 'Invalid invite data' });
      }
    }
  });

  // Company Manager Invite Management
  // Fix existing invites that don't have companyId set
  app.post('/api/company-manager/fix-invites', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }

      // Get all invites created by users from this company that don't have companyId set
      const companyUsers = await storage.getUsersByCompany(req.user!.companyId);
      const companyUserIds = companyUsers.map(u => u.id);
      
      if (companyUserIds.length > 0) {
        // Update invites that don't have companyId but were created by company users
        await db.update(invites)
          .set({ companyId: req.user!.companyId })
          .where(
            and(
              isNull(invites.companyId),
              inArray(invites.createdByUserId, companyUserIds)
            )
          );
      }

      res.json({ message: 'Invites fixed successfully' });
    } catch (error) {
      console.error('Fix invites error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/company-manager/invites', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }

      // Get all invites for the company (both sent by this manager and other managers in the same company)
      const allInvites = await storage.getInvitesByCompany(req.user!.companyId);
      
      // Filter to only show MANAGER and ADMIN invites (exclude TENANT invites)
      const managerInvites = allInvites.filter(invite => 
        invite.role === 'MANAGER' || invite.role === 'ADMIN'
      );
      
      // Get creator information for each invite
      const invitesWithDetails = await Promise.all(managerInvites.map(async (invite) => {
        const creator = await storage.getUser(invite.createdByUserId);
        return {
          ...invite,
          token: invite.token,
          createdByUserName: creator?.fullName || 'Unknown'
        };
      }));
      
      res.json(invitesWithDetails);
    } catch (error) {
      console.error('Get company invites error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/company-manager/invites', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      if (!req.user!.companyId) {
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }

      const { email, fullName, role, parkId } = req.body;
      
      if (!email || !fullName || !role) {
        return res.status(400).json({ message: 'Email, full name, and role are required' });
      }

      // Validate role
      if (!['MANAGER', 'ADMIN'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be MANAGER or ADMIN' });
      }

      // Validate park selection for MANAGER role
      if (role === 'MANAGER' && !parkId) {
        return res.status(400).json({ message: 'Park selection is required for MANAGER role' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      // Check if there's already a pending invite for this email
      const existingInvite = await storage.getInviteByEmail(email);
      if (existingInvite && !existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
        return res.status(409).json({ message: 'A pending invite already exists for this email' });
      }

      // For MANAGER role, validate that the park belongs to the company
      if (role === 'MANAGER') {
        const park = await storage.getPark(parkId);
        if (!park || park.companyId !== req.user!.companyId) {
          return res.status(400).json({ message: 'Park does not belong to your company' });
        }
      }

      // Generate secure token
      const token = randomBytes(32).toString('hex');
      
      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await storage.createInvite({
        email,
        role,
        companyId: req.user!.companyId, // Both MANAGER and ADMIN belong to the same company
        parkId: role === 'MANAGER' ? parkId : undefined,
        createdByUserId: req.user!.id,
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
        token, // Include token for copy link functionality
        inviteUrl,
        emailSent
      });
    } catch (error) {
      console.error('Create company manager invite error:', error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(400).json({ message: 'Invalid invite data' });
      }
    }
  });

  app.delete('/api/company-manager/invites/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthRequest, res) => {
    try {
      console.log('[DELETE INVITE] Request from user:', req.user?.id, 'Company:', req.user?.companyId, 'Invite ID:', req.params.id);
      
      if (!req.user!.companyId) {
        console.log('[DELETE INVITE] User has no companyId');
        return res.status(400).json({ message: 'Company manager must be assigned to a company' });
      }

      const invite = await storage.getInvite(req.params.id);
      if (!invite) {
        console.log('[DELETE INVITE] Invite not found:', req.params.id);
        return res.status(404).json({ message: 'Invite not found' });
      }

      console.log('[DELETE INVITE] Invite details:', {
        inviteId: invite.id,
        inviteRole: invite.role,
        inviteCompanyId: invite.companyId,
        inviteParkId: invite.parkId,
        inviteEmail: invite.email,
        createdByUserId: invite.createdByUserId
      });

      // Validate that this is a MANAGER or ADMIN invite
      if (invite.role !== 'MANAGER' && invite.role !== 'ADMIN') {
        console.log('[DELETE INVITE] Invalid role for company manager invites:', invite.role);
        return res.status(400).json({ message: 'This endpoint only handles MANAGER and ADMIN invites' });
      }

      // Check if the invite belongs to the same company
      // Method 1: Invite has companyId set and it matches user's company
      // Method 2: Invite was created by a user from the same company (for backward compatibility)
      // Method 3: For legacy MANAGER invites, check if park belongs to user's company
      let hasAccess = false;
      
      if (invite.companyId) {
        // Invite has companyId set (both MANAGER and ADMIN)
        hasAccess = invite.companyId === req.user!.companyId;
        console.log('[DELETE INVITE] CompanyId check:', {
          inviteCompanyId: invite.companyId,
          userCompanyId: req.user!.companyId,
          match: hasAccess
        });
      } else {
        // For invites without companyId, check if creator is from the same company
        const creator = await storage.getUser(invite.createdByUserId);
        console.log('[DELETE INVITE] Creator check:', {
          creatorId: invite.createdByUserId,
          creatorFound: !!creator,
          creatorCompanyId: creator?.companyId,
          userCompanyId: req.user!.companyId
        });
        
        if (creator && creator.companyId === req.user!.companyId) {
          hasAccess = true;
          console.log('[DELETE INVITE] Access granted via creator company match');
        } else if (invite.parkId) {
          // Fallback: check if park belongs to user's company
          const park = await storage.getParkAny(invite.parkId);
          hasAccess = park?.companyId === req.user!.companyId;
          console.log('[DELETE INVITE] ParkId fallback check:', {
            inviteParkId: invite.parkId,
            parkFound: !!park,
            parkCompanyId: park?.companyId,
            userCompanyId: req.user!.companyId,
            match: hasAccess
          });
        }
      }

      if (!hasAccess) {
        console.log('[DELETE INVITE] Access denied - hasAccess:', hasAccess);
        return res.status(403).json({ message: 'Access denied to this invite' });
      }

      console.log('[DELETE INVITE] Access granted, deleting invite:', req.params.id);
      await storage.deleteInvite(req.params.id);
      
      console.log('[DELETE INVITE] Successfully deleted invite:', req.params.id);
      res.json({ message: 'Invite cancelled successfully' });
    } catch (error) {
      console.error('[DELETE INVITE] Error:', error);
      res.status(500).json({ message: 'Internal server error' });
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

      // Determine the companyId for the user
      let userCompanyId = invite.companyId;
      
      // For MANAGER role with a park assignment, get the company from the park
      if (invite.role === 'MANAGER' && invite.parkId && !userCompanyId) {
        try {
          const park = await storage.getPark(invite.parkId);
          if (park) {
            userCompanyId = park.companyId;
            console.log(`Setting MANAGER companyId to ${userCompanyId} from park ${invite.parkId}`);
          }
        } catch (parkError) {
          console.error('Failed to fetch park for companyId:', parkError);
        }
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
            companyId: userCompanyId,
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
          companyId: userCompanyId,
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

      // If this is a MANAGER, automatically assign the specified park
      if (invite.role === 'MANAGER' && invite.parkId) {
        try {
          await storage.assignManagerToPark(user.id, invite.parkId);
          console.log(`Auto-assigned park ${invite.parkId} to MANAGER ${user.email}`);
        } catch (parkError) {
          console.error('Failed to auto-assign park to manager:', parkError);
          // Don't fail the entire request if park assignment fails
        }
      }

      // If this is an ADMIN, automatically assign all company parks
      if (invite.role === 'ADMIN' && userCompanyId) {
        try {
          const companyParks = await storage.getParks({ companyId: userCompanyId });
          for (const park of companyParks.parks) {
            await storage.assignManagerToPark(user.id, park.id);
          }
          console.log(`Auto-assigned ${companyParks.parks.length} parks to ADMIN ${user.email}`);
        } catch (parkError) {
          console.error('Failed to auto-assign company parks:', parkError);
          // Don't fail the entire request if park assignment fails
        }
      }

      const tokens = generateTokens(user);
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          fullName: user.fullName, 
          role: user.role,
          companyId: user.companyId
        },
        ...tokens
      });
    } catch (error) {
      console.error('Accept invite error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Audit Logs routes
  app.get('/api/audit-logs/:entityType/:entityId', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const { limit } = req.query;
      
      const auditLogs = await storage.getAuditLogs(
        entityType.toUpperCase(),
        entityId,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(auditLogs);
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company routes
  app.get('/api/companies', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const { includeInactive } = req.query;
      const companies = await storage.getCompanies(includeInactive === 'true');
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/companies', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
    try {
      const parsed = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(parsed);
      
      // Log creation
      if (req.user) {
        await logCreation(
          'COMPANY',
          company.id,
          company.name,
          req.user.id,
          req.user.fullName,
          req.user.role
        );
      }
      
      res.status(201).json(company);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(400).json({ message: 'Invalid company data' });
    }
  });

  app.get('/api/companies/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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

  app.patch('/api/companies/:id', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
    try {
      // Get old company data before update
      const oldCompany = await storage.getCompany(req.params.id);
      
      const updates = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(req.params.id, updates);
      
      // Log changes
      if (req.user && oldCompany) {
        const auditEntries = compareObjects(
          oldCompany,
          company,
          req.user.id,
          req.user.fullName,
          req.user.role,
          'COMPANY',
          company.id,
          company.name
        );
        await logAuditEntries(auditEntries);
      }
      
      res.json(company);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(400).json({ message: 'Invalid company data' });
    }
  });

  app.delete('/api/companies/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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

  app.post('/api/companies/:id/photos', authenticateToken, requireCompanyAccess, upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      // Debug: Log the request body to see what captions are being sent
      console.log('Company photo upload request body:', req.body);
      console.log('Captions string:', req.body.captions);
      console.log('Single caption:', req.body.caption);

      // Parse captions from JSON string
      let captionsArray = [];
      try {
        if (req.body.captions) {
          captionsArray = JSON.parse(req.body.captions);
        }
      } catch (error) {
        console.error('Error parsing captions JSON:', error);
        // Fallback to empty array
        captionsArray = [];
      }
      console.log('Parsed captions array:', captionsArray);

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('COMPANY', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        
        // Extract caption for this specific photo
        let caption = '';
        if (Array.isArray(captionsArray) && captionsArray[i]) {
          caption = captionsArray[i];
        } else if (req.body.caption) {
          caption = req.body.caption;
        }
        
        console.log(`Company photo ${i} caption:`, caption);
        
        // Upload to S3
        const s3Result = await uploadToS3(file, 'companies');
        console.log('Uploaded to S3:', s3Result.url);
        
        // Save metadata to database (without base64 data)
        const photo = await storage.createPhoto({
          entityType: 'COMPANY',
          entityId: req.params.id,
          urlOrPath: s3Result.url, // URL de S3
          imageData: null, // Ya no guardamos base64
          mimeType: file.mimetype || 'image/jpeg',
          caption: caption,
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
  app.patch('/api/companies/:id/toggle-active', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'MHP_LORD';
      
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
      
      // Parse amenities from JSON strings back to objects
      parksArray.forEach((park: any) => {
        if (park.amenities && Array.isArray(park.amenities)) {
          park.amenities = park.amenities.map((amenity: any) => {
            if (!amenity) return amenity;
            try {
              if (typeof amenity === 'string' && amenity.trim().startsWith('{')) {
                return JSON.parse(amenity);
              }
              return amenity;
            } catch (e) {
              console.error('Failed to parse amenity:', amenity, e);
              return amenity;
            }
          });
        }
      });
      
      // Pagination logic
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedParks = parksArray.slice(startIndex, endIndex);
      const totalParks = parksArray.length;
      const totalPages = Math.ceil(totalParks / limitNum);
      
      // Generate page numbers for pagination UI (max 5 pages)
      const pageNumbers = [];
      const maxPages = 5;
      let startPage = Math.max(1, pageNum - Math.floor(maxPages / 2));
      let endPage = Math.min(totalPages, startPage + maxPages - 1);
      
      if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      res.json({
        parks: paginatedParks,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          total: totalParks,
          limit: limitNum,
          startItem: totalParks > 0 ? startIndex + 1 : 0,
          endItem: Math.min(endIndex, totalParks),
          pageNumbers: pageNumbers
        }
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
      
      // Parse amenities from JSON strings back to objects
      if (park.amenities && Array.isArray(park.amenities)) {
        park.amenities = park.amenities.map((amenity: any) => {
          if (!amenity) return amenity;
          try {
            if (typeof amenity === 'string' && amenity.trim().startsWith('{')) {
              return JSON.parse(amenity);
            }
            return amenity;
          } catch (e) {
            console.error('Failed to parse amenity:', amenity, e);
            return amenity;
          }
        });
      }
      
      res.json(park);
    } catch (error) {
      console.error('Get park error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/parks', authenticateToken, requireRole(['MHP_LORD', 'ADMIN']), async (req: AuthRequest, res) => {
    try {
      // For ADMIN users, enforce that the park belongs to their company
      // Set companyId before validation
      if (req.user?.role === 'ADMIN') {
        if (!req.user.companyId) {
          return res.status(403).json({ message: 'Admin must be assigned to a company' });
        }
        // Set the companyId to the admin's company before parsing
        req.body.companyId = req.user.companyId;
      }
      
      const parsed = insertParkSchema.parse(req.body);
      
      // Schema already transforms amenity objects to JSON strings
      const park = await storage.createPark(parsed);
      
      // Parse amenities back to objects for response
      if (park.amenities && Array.isArray(park.amenities)) {
        park.amenities = park.amenities.map((amenity: any) => {
          if (!amenity) return amenity;
          try {
            if (typeof amenity === 'string' && amenity.trim().startsWith('{')) {
              return JSON.parse(amenity);
            }
            return amenity;
          } catch (e) {
            console.error('Failed to parse amenity:', amenity, e);
            return amenity;
          }
        });
      }
      
      // Log creation
      if (req.user) {
        await logCreation(
          'PARK',
          park.id,
          park.name,
          req.user.id,
          req.user.fullName,
          req.user.role
        );
      }
      
      res.status(201).json(park);
    } catch (error) {
      console.error('Create park error:', error);
      res.status(400).json({ message: 'Invalid park data' });
    }
  });

  app.patch('/api/parks/:id', authenticateToken, requireParkAccess, async (req: AuthRequest, res) => {
    try {
      // Get old park data before update
      const oldPark = await storage.getPark(req.params.id);
      
      const updates = insertParkSchema.partial().parse(req.body);
      
      // Check if lotRent is being updated
      if (updates.lotRent !== undefined) {
        // Update all lots in this park with the new lot rent
        await storage.updateLotRentForPark(req.params.id, updates.lotRent as any);
      }
      
      // Schema already transforms amenity objects to JSON strings
      const park = await storage.updatePark(req.params.id, updates);
      
      // Parse amenities back to objects for response
      if (park.amenities && Array.isArray(park.amenities)) {
        park.amenities = park.amenities.map((amenity: any) => {
          if (!amenity) return amenity;
          try {
            if (typeof amenity === 'string' && amenity.trim().startsWith('{')) {
              return JSON.parse(amenity);
            }
            return amenity;
          } catch (e) {
            console.error('Failed to parse amenity:', amenity, e);
            return amenity;
          }
        });
      }
      
      // Log changes
      if (req.user && oldPark) {
        const auditEntries = compareObjects(
          oldPark,
          park,
          req.user.id,
          req.user.fullName,
          req.user.role,
          'PARK',
          park.id,
          park.name
        );
        await logAuditEntries(auditEntries);
      }
      
      res.json(park);
    } catch (error) {
      console.error('Update park error:', error);
      res.status(400).json({ message: 'Invalid park data' });
    }
  });

  app.delete('/api/parks/:id', authenticateToken, requireParkAccess, async (req, res) => {
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
    { name: 'photos', maxCount: 20 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      // Debug: Log the request body to see what captions are being sent
      console.log('Photo upload request body:', req.body);
      console.log('Captions string:', req.body.captions);
      console.log('Single caption:', req.body.caption);

      // Parse captions from JSON string
      let captionsArray = [];
      try {
        if (req.body.captions) {
          captionsArray = JSON.parse(req.body.captions);
        }
      } catch (error) {
        console.error('Error parsing captions JSON:', error);
        // Fallback to empty array
        captionsArray = [];
      }
      console.log('Parsed captions array:', captionsArray);

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('PARK', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        
        // Extract caption for this specific photo
        let caption = '';
        if (Array.isArray(captionsArray) && captionsArray[i]) {
          caption = captionsArray[i];
        } else if (req.body.caption) {
          caption = req.body.caption;
        }
        
        console.log(`Photo ${i} caption:`, caption);
        
        // Upload to S3
        const s3Result = await uploadToS3(file, 'parks');
        console.log('Uploaded to S3:', s3Result.url);
        
        // Save metadata to database (without base64 data)
        const photo = await storage.createPhoto({
          entityType: 'PARK',
          entityId: req.params.id,
          urlOrPath: s3Result.url, // URL de S3
          imageData: null, // Ya no guardamos base64
          mimeType: file.mimetype || 'image/jpeg',
          caption: caption,
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
  app.post('/api/parks/:parkId/managers/:userId', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'MHP_LORD';
      
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
      let hasAccess: boolean = false;
      
      if (req.user?.role === 'MHP_LORD') {
        hasAccess = true;
      } else if (req.user?.role === 'MANAGER') {
        const managerAssignments = await storage.getManagerAssignments(req.user.id, existingStatus.parkId);
        hasAccess = managerAssignments.length > 0;
      } else if (req.user?.role === 'ADMIN') {
        if (!req.user.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }
        const park = await storage.getPark(existingStatus.parkId);
        hasAccess = !!(park && park.companyId === req.user.companyId);
      }
      
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
      let hasAccess: boolean = false;
      
      if (req.user?.role === 'MHP_LORD') {
        hasAccess = true;
      } else if (req.user?.role === 'MANAGER') {
        const managerAssignments = await storage.getManagerAssignments(req.user.id, existingStatus.parkId);
        hasAccess = managerAssignments.length > 0;
      } else if (req.user?.role === 'ADMIN') {
        if (!req.user.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }
        const park = await storage.getPark(existingStatus.parkId);
        hasAccess = !!(park && park.companyId === req.user.companyId);
      }
      
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
  app.post('/api/admin/lots/bulk', authenticateToken, requireRole('MHP_LORD'), async (req: AuthRequest, res) => {
    try {
      const { lots } = req.body;
      
      if (!Array.isArray(lots) || lots.length === 0) {
        return res.status(400).json({ message: 'Lots array is required' });
      }

      if (lots.length > 1000) {
        return res.status(400).json({ message: 'Maximum 1000 lots per upload' });
      }

      const results: { successful: any[], failed: any[], warnings?: any[] } = { successful: [], failed: [], warnings: [] };
      
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
          let lotParkId: string | undefined;
          
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
          // Note: Lots without park assignment are now allowed and can be assigned later by admins/MHP_LORD

          // Handle special status if provided
          let specialStatusId: string | null = null;
          if (lotData.specialStatus && String(lotData.specialStatus).trim()) {
            const specialStatusName = String(lotData.specialStatus).trim();
            
            // Special status requires a park assignment
            if (!lotParkId) {
              results.failed.push({
                row: rowNumber,
                error: `Cannot assign special status '${specialStatusName}' without a park assignment. Please specify Park Name or Park ID.`
              });
              continue;
            }
            
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
            price: lotData.price && String(lotData.price).trim() !== "" ? String(lotData.price) : null,
            description: lotData.description ? String(lotData.description).trim() : "",
            bedrooms: lotData.bedrooms && String(lotData.bedrooms).trim() !== "" ? parseInt(lotData.bedrooms) || null : null,
            bathrooms: lotData.bathrooms && String(lotData.bathrooms).trim() !== "" ? parseInt(lotData.bathrooms) || null : null,
            sqFt: lotData.sqFt && String(lotData.sqFt).trim() !== "" ? parseInt(lotData.sqFt) || null : null,
            lotRent: lotData.lotRent && String(lotData.lotRent).trim() !== "" ? String(lotData.lotRent) : null,
            showingLink: lotData.showingLink && String(lotData.showingLink).trim() !== "" ? String(lotData.showingLink).trim() : null,
            houseManufacturer: lotData.houseManufacturer && String(lotData.houseManufacturer).trim() !== "" ? String(lotData.houseManufacturer).trim() : null,
            houseModel: lotData.houseModel && String(lotData.houseModel).trim() !== "" ? String(lotData.houseModel).trim() : null,
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
          
          // Get park name for notification if parkId exists
          let parkNameForEmail: string | undefined;
          if (newLot.parkId) {
            const park = await storage.getPark(newLot.parkId);
            parkNameForEmail = park?.name;
          }
          
          // Send notification email (don't fail the upload if email fails)
          try {
            await sendLotCreationNotification(
              {
                id: newLot.id,
                nameOrNumber: newLot.nameOrNumber,
                parkName: parkNameForEmail,
                status: newLot.status || [],
                description: newLot.description || undefined,
                bedrooms: newLot.bedrooms,
                bathrooms: newLot.bathrooms,
              },
              req.user!.fullName
            );
          } catch (emailError) {
            console.error(`Failed to send lot creation notification for lot ${newLot.nameOrNumber}:`, emailError);
          }
          
          // Add warning if lot was created without park assignment
          if (!newLot.parkId) {
            results.warnings!.push({
              row: rowNumber,
              lotName: newLot.nameOrNumber,
              message: `Lot '${newLot.nameOrNumber}' was created without park assignment. You can assign it to a park later.`
            });
          }

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

      const results: { successful: any[], failed: any[], warnings?: any[], assignedPark?: string, multiPark?: boolean, assignedParks?: any[] } = { 
        successful: [], 
        failed: [],
        warnings: [],
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
            price: lotData.price && String(lotData.price).trim() !== "" ? String(lotData.price) : null,
            description: lotData.description ? String(lotData.description).trim() : "",
            bedrooms: lotData.bedrooms && String(lotData.bedrooms).trim() !== "" ? parseInt(lotData.bedrooms) || null : null,
            bathrooms: lotData.bathrooms && String(lotData.bathrooms).trim() !== "" ? parseInt(lotData.bathrooms) || null : null,
            sqFt: lotData.sqFt && String(lotData.sqFt).trim() !== "" ? parseInt(lotData.sqFt) || null : null,
            lotRent: lotData.lotRent && String(lotData.lotRent).trim() !== "" ? String(lotData.lotRent) : null,
            showingLink: lotData.showingLink && String(lotData.showingLink).trim() !== "" ? String(lotData.showingLink).trim() : null,
            houseManufacturer: lotData.houseManufacturer && String(lotData.houseManufacturer).trim() !== "" ? String(lotData.houseManufacturer).trim() : null,
            houseModel: lotData.houseModel && String(lotData.houseModel).trim() !== "" ? String(lotData.houseModel).trim() : null,
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
          
          // Get park name for notification if parkId exists
          let parkNameForEmail: string | undefined;
          if (newLot.parkId) {
            const park = await storage.getPark(newLot.parkId);
            parkNameForEmail = park?.name;
          }
          
          // Send notification email (don't fail the upload if email fails)
          try {
            await sendLotCreationNotification(
              {
                id: newLot.id,
                nameOrNumber: newLot.nameOrNumber,
                parkName: parkNameForEmail,
                status: newLot.status || [],
                description: newLot.description || undefined,
                bedrooms: newLot.bedrooms,
                bathrooms: newLot.bathrooms,
              },
              req.user!.fullName
            );
          } catch (emailError) {
            console.error(`Failed to send lot creation notification for lot ${newLot.nameOrNumber}:`, emailError);
          }
          
          // Add warning if lot was created without park assignment
          if (!newLot.parkId) {
            results.warnings!.push({
              row: rowNumber,
              lotName: newLot.nameOrNumber,
              message: `Lot '${newLot.nameOrNumber}' was created without park assignment. You can assign it to a park later.`
            });
          }

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
      const { parkId, status, minPrice, maxPrice, bedrooms, bathrooms, state, q, price, page = '1', limit = '50' } = req.query;
      
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
      const limitNum = Math.min(parseInt(limit as string), 1000);
      const totalPages = Math.ceil(lots.length / limitNum);
      
      // Validate page number
      const validPageNum = Math.max(1, Math.min(pageNum, totalPages || 1));
      const offset = (validPageNum - 1) * limitNum;
      
      const paginatedLots = lots.slice(offset, offset + limitNum);
      
      // Calculate navigation information
      const hasNextPage = validPageNum < totalPages;
      const hasPrevPage = validPageNum > 1;
      const startItem = totalPages > 0 ? offset + 1 : 0;
      const endItem = Math.min(offset + limitNum, lots.length);
      
      // Generate page numbers for navigation (show up to 5 pages around current)
      const generatePageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, validPageNum - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust if we're near the end
        if (endPage - startPage + 1 < maxVisiblePages) {
          startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }
        return pages;
      };
      
      const response = {
        lots: paginatedLots,
        pagination: {
          // Current page info
          currentPage: validPageNum,
          totalPages: totalPages,
          limit: limitNum,
          total: lots.length,
          
          // Item range info
          startItem: startItem,
          endItem: endItem,
          
          // Navigation controls
          hasNextPage: hasNextPage,
          hasPrevPage: hasPrevPage,
          nextPage: hasNextPage ? validPageNum + 1 : null,
          prevPage: hasPrevPage ? validPageNum - 1 : null,
          firstPage: totalPages > 0 ? 1 : null,
          lastPage: totalPages > 0 ? totalPages : null,
          
          // Page numbers for navigation
          pageNumbers: generatePageNumbers(),
          
          // Additional metadata
          isEmpty: lots.length === 0,
          isFirstPage: validPageNum === 1,
          isLastPage: validPageNum === totalPages
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
      const shouldIncludeInactive = includeInactive === 'true' && req.user?.role === 'MHP_LORD';
      
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
      const maxLimit = req.user?.role === 'MHP_LORD' ? 10000 : 100;
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

  app.post('/api/lots', authenticateToken, requireLotAccess, async (req: AuthRequest, res) => {
    try {
      const parsed = insertLotSchema.parse(req.body);
      const lot = await storage.createLot(parsed);
      
      // Get park name for notification if parkId exists
      let parkName: string | undefined;
      let park: any = undefined;
      if (lot.parkId) {
        park = await storage.getPark(lot.parkId);
        parkName = park?.name;
      }
      
      // Send notification email (don't fail the request if email fails)
      try {
        await sendLotCreationNotification(
          {
            id: lot.id,
            nameOrNumber: lot.nameOrNumber,
            parkName,
            status: lot.status || [],
            description: lot.description || undefined,
            bedrooms: lot.bedrooms,
            bathrooms: lot.bathrooms,
          },
          req.user?.fullName || 'Sistema'
        );
      } catch (emailError) {
        console.error('Failed to send lot creation notification email:', emailError);
      }
      
      // Attempt to export to Google Sheets (don't fail the request if export fails)
      let sheetsExportSuccess = false;
      let sheetsExportError: string | null = null;
      let spreadsheetUrl: string | null = null;
      
      try {
        const userId = req.user?.id;
        if (userId) {
          // Check if user has Google Sheets connected
          const oauthAccount = await storage.getOAuthAccount(userId, 'google-sheets');
          
          if (!oauthAccount) {
            sheetsExportError = 'Please connect your Google account in settings.';
          } else if (!oauthAccount.spreadsheetId) {
            sheetsExportError = 'Please link a spreadsheet in settings.';
          } else {
            // Prepare lot data with park information
            const lotWithPark = {
              ...lot,
              park: park
            };
            
            const exportResult = await googleSheetsService.exportLotToSheet(userId, lotWithPark);
            sheetsExportSuccess = true;
            spreadsheetUrl = exportResult.spreadsheetUrl;
          }
        }
      } catch (exportError) {
        console.error('Failed to export lot to Google Sheets:', exportError);
        sheetsExportError = exportError instanceof Error ? exportError.message : 'Unknown export error';
      }
      
      // Log creation
      if (req.user) {
        await logCreation(
          'LOT',
          lot.id,
          lot.nameOrNumber,
          req.user.id,
          req.user.fullName,
          req.user.role
        );
      }
      
      res.status(201).json({
        ...lot,
        sheetsExportSuccess,
        sheetsExportError,
        spreadsheetUrl
      });
    } catch (error: unknown) {
      console.error('Create lot error:', error);
      res.status(400).json({ message: 'Invalid lot data' });
    }
  });

  app.patch('/api/lots/:id', authenticateToken, requireLotAccess, async (req: AuthRequest, res) => {
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
      
      // Fetch the current lot to check if it's being reactivated
      const currentLot = await storage.getLotAny(req.params.id);
      if (!currentLot) {
        return res.status(404).json({ message: 'Lot not found' });
      }
      const wasInactive = currentLot.isActive === false;
      
      const lot = await storage.updateLot(req.params.id, validation.data);
      console.log('✅ Database update successful');
      
      // Log changes
      if (req.user) {
        const auditEntries = compareObjects(
          currentLot,
          lot,
          req.user.id,
          req.user.fullName,
          req.user.role,
          'LOT',
          lot.id,
          lot.nameOrNumber
        );
        await logAuditEntries(auditEntries);
      }
      
      // Check if lot was reactivated (changed from inactive to active)
      console.log('🔍 [ADMIN] Reactivation check:', { 
        wasInactive, 
        newIsActive: validation.data.isActive,
        isBeingReactivated: wasInactive && validation.data.isActive === true 
      });
      const isBeingReactivated = wasInactive && validation.data.isActive === true;
      
      if (isBeingReactivated) {
        console.log('✅ [ADMIN] Lot is being reactivated, sending email...');
        // Send reactivation notification (don't fail the request if email fails)
        try {
          let parkName: string | undefined;
          if (lot.parkId) {
            const park = await storage.getPark(lot.parkId);
            parkName = park?.name;
          }
          
          await sendLotReactivationNotification(
            {
              id: lot.id,
              nameOrNumber: lot.nameOrNumber,
              parkName,
              status: lot.status || [],
              description: lot.description || undefined,
              bedrooms: lot.bedrooms,
              bathrooms: lot.bathrooms,
            },
            (req as AuthRequest).user?.fullName || 'Sistema'
          );
        } catch (emailError) {
          console.error('Failed to send lot reactivation notification email:', emailError);
        }
      }
      
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
      const isAdmin = req.user!.role === 'MHP_LORD';
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
    { name: 'photos', maxCount: 20 },
    { name: 'photo', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allFiles = [...(files?.photos || []), ...(files?.photo || [])];
      
      if (allFiles.length === 0) {
        return res.status(400).json({ message: 'At least one photo file required' });
      }

      // Debug: Log the request body to see what captions are being sent
      console.log('Lot photo upload request body:', req.body);
      console.log('Captions string:', req.body.captions);
      console.log('Single caption:', req.body.caption);

      // Parse captions from JSON string
      let captionsArray = [];
      try {
        if (req.body.captions) {
          captionsArray = JSON.parse(req.body.captions);
        }
      } catch (error) {
        console.error('Error parsing captions JSON:', error);
        // Fallback to empty array
        captionsArray = [];
      }
      console.log('Parsed captions array:', captionsArray);

      const photos = [];
      const currentPhotoCount = (await storage.getPhotos('LOT', req.params.id)).length;

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i];
        
        // Extract caption for this specific photo
        let caption = '';
        if (Array.isArray(captionsArray) && captionsArray[i]) {
          caption = captionsArray[i];
        } else if (req.body.caption) {
          caption = req.body.caption;
        }
        
        console.log(`Lot photo ${i} caption:`, caption);
        
        // Upload to S3
        const s3Result = await uploadToS3(file, 'lots');
        console.log('Uploaded to S3:', s3Result.url);
        
        // Save metadata to database (without base64 data)
        const photo = await storage.createPhoto({
          entityType: 'LOT',
          entityId: req.params.id,
          urlOrPath: s3Result.url, // URL de S3
          imageData: null, // Ya no guardamos base64
          mimeType: file.mimetype || 'image/jpeg',
          caption: caption,
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
      
      // Store original isActive status to detect reactivation
      const wasInactive = lot.isActive === false;
      const newIsActive = !lot.isActive;
      
      console.log('🔍 [TOGGLE] Reactivation check:', { 
        lotId: lot.id,
        lotName: lot.nameOrNumber,
        wasInactive, 
        newIsActive,
        isBeingReactivated: wasInactive && newIsActive === true 
      });
      
      const updatedLot = await storage.updateLot(req.params.id, {
        isActive: newIsActive
      });
      
      // Check if lot was reactivated (changed from inactive to active)
      const isBeingReactivated = wasInactive && newIsActive === true;
      
      if (isBeingReactivated) {
        console.log('✅ [TOGGLE] Lot is being reactivated, sending email...');
        // Send reactivation notification (don't fail the request if email fails)
        try {
          let parkName: string | undefined;
          if (updatedLot.parkId) {
            const park = await storage.getPark(updatedLot.parkId);
            parkName = park?.name;
          }
          
          await sendLotReactivationNotification(
            {
              id: updatedLot.id,
              nameOrNumber: updatedLot.nameOrNumber,
              parkName,
              status: updatedLot.status || [],
              description: updatedLot.description || undefined,
              bedrooms: updatedLot.bedrooms,
              bathrooms: updatedLot.bathrooms,
            },
            (req as AuthRequest).user?.fullName || 'Sistema'
          );
          console.log('✅ [TOGGLE] Reactivation email sent successfully');
        } catch (emailError) {
          console.error('❌ [TOGGLE] Failed to send lot reactivation notification email:', emailError);
        }
      }
      
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

  // Debug endpoint to check tenant-lot relationships
  app.get('/api/debug/tenant-lots', authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const tenants = await storage.getTenants();
      const issues = [];
      
      for (const tenant of tenants) {
        if (tenant.lotId) {
          const lot = await storage.getLotAny(tenant.lotId);
          if (!lot) {
            issues.push({
              tenantId: tenant.id,
              tenantName: `${tenant.firstName} ${tenant.lastName}`,
              missingLotId: tenant.lotId
            });
          }
        }
      }
      
      res.json({ 
        totalTenants: tenants.length,
        tenantsWithLots: tenants.filter(t => t.lotId).length,
        issues: issues,
        message: issues.length > 0 ? 'Found data integrity issues' : 'No issues found'
      });
    } catch (error) {
      console.error('Debug tenant-lots error:', error);
      res.status(500).json({ message: 'Failed to check tenant-lot relationships' });
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
        
        // MHP_LORD (super admin) sees all tenants
        if (req.user!.role === 'MHP_LORD') {
          return res.json({ tenants });
        }
        
        // For regular managers, filter by their assigned parks
        if (req.user!.role === 'MANAGER') {
          const assignments = await storage.getManagerAssignments(req.user!.id);
          const parkIds = assignments.map(a => a.parkId);
          
          // Show tenants that either don't have a lot assigned, OR have a lot in manager's parks
          // If manager has no park assignments, show only tenants without lot assignments
          const filteredTenants = tenants.filter(Tenant => 
            !Tenant.lot || (parkIds.length > 0 && parkIds.includes(Tenant.lot.parkId))
          );
          return res.json({ tenants: filteredTenants });
        } 
        
        // For company managers (ADMIN role), filter by their company's parks
        if (req.user!.role === 'ADMIN') {
          if (!req.user!.companyId) {
            return res.status(400).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const companyParks = await storage.getParksByCompany(req.user!.companyId);
          const parkIds = companyParks.parks.map(p => p.id);
          
          // Show tenants that either don't have a lot assigned, OR have a lot in company's parks
          // If company has no parks, show only tenants without lot assignments
          const filteredTenants = tenants.filter(Tenant => 
            !Tenant.lot || (parkIds.length > 0 && parkIds.includes(Tenant.lot.parkId))
          );
          return res.json({ tenants: filteredTenants });
        }
        
        // Default: show all tenants
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
      const tenant = await storage.getTenant(tenantId);
      
      console.log(`getTenant(${tenantId}) returned:`, !!tenant);
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found' });
      }

      // MHP_LORD (super admin) has access to all tenants
      if (req.user!.role === 'MHP_LORD') {
        console.log(`✅ MHP_LORD has access to all tenants`);
      } 
      // For regular managers, check if they have access to this tenant's lot
      else if (req.user!.role === 'MANAGER') {
        console.log(`Manager checking access for tenant ${tenantId}, lot: ${tenant.lotId}`);
        
        // If tenant has no lot assigned, allow access (tenant might not be assigned to a lot yet)
        if (!tenant.lotId) {
          console.log(`✅ Tenant has no lot assigned, allowing access`);
        } else {
          const lot = await storage.getLotAny(tenant.lotId);
          console.log(`Lot found:`, !!lot);
          
          if (!lot) {
            console.log(`⚠️ Lot ${tenant.lotId} not found, but allowing access to tenant`);
            // Don't block access if lot is missing - this is a data integrity issue
            // The tenant still exists and should be viewable
          } else {
            const assignments = await storage.getManagerAssignments(req.user!.id);
            console.log(`Manager assignments:`, assignments.map(a => a.parkId));
            console.log(`Lot park ID:`, lot.parkId);
            const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
            console.log(`Manager has access:`, hasAccess);
            if (!hasAccess) {
              console.log(`❌ Access denied to tenant ${tenantId}`);
              return res.status(403).json({ message: 'Access denied to this tenant' });
            }
          }
        }
      } 
      // For company managers (ADMIN role), check if tenant's lot is in their company
      else if (req.user!.role === 'ADMIN') {
        console.log(`Company manager checking access for tenant ${tenantId}, lot: ${tenant.lotId}`);
        
        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }
        
        // If tenant has no lot assigned, allow access (tenant might not be assigned to a lot yet)
        if (!tenant.lotId) {
          console.log(`✅ Tenant has no lot assigned, allowing access`);
        } else {
          const lot = await storage.getLotAny(tenant.lotId);
          console.log(`Lot found:`, !!lot);
          
          if (!lot) {
            console.log(`⚠️ Lot ${tenant.lotId} not found, but allowing access to tenant`);
            // Don't block access if lot is missing - this is a data integrity issue
            // The tenant still exists and should be viewable
          } else {
            const park = await storage.getPark(lot.parkId);
            console.log(`Park found:`, !!park);
            console.log(`Park company ID:`, park?.companyId);
            console.log(`User company ID:`, req.user!.companyId);
            const hasAccess = park && park.companyId === req.user!.companyId;
            console.log(`Company manager has access:`, hasAccess);
            if (!hasAccess) {
              console.log(`❌ Access denied to tenant ${tenantId}`);
              return res.status(403).json({ message: 'Access denied to this tenant' });
            }
          }
        }
      }

      // Get tenant with lot and park info
      const tenantWithInfo = await storage.getTenantsWithLotInfo();
      const fullTenant = tenantWithInfo.find(t => t.id === tenantId);
      
      console.log(`Looking for tenant ${tenantId}, found in getTenantsWithLotInfo: ${!!fullTenant}`);
      
      // If fullTenant is not found (due to missing lot/park relationships), 
      // return the basic tenant info with null lot/park data
      if (!fullTenant) {
        console.log(`⚠️ Tenant not found in getTenantsWithLotInfo, returning basic tenant data`);
        const tenantWithNullLot = {
          ...tenant,
          lot: null,
          park: null
        };
        res.json({ tenant: tenantWithNullLot });
      } else {
        res.json({ tenant: fullTenant });
      }
    } catch (error) {
      console.error('Get tenant error:', error);
      res.status(500).json({ message: 'Failed to fetch tenant' });
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

      // For company managers, verify they have access to the specified lot
      if (req.user!.role === 'MHP_LORD') {
        const lot = await storage.getLot(tenantData.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Lot not found' });
        }

        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }

        const companyParks = await storage.getParksByCompany(req.user!.companyId);
        const hasAccess = companyParks.parks.some(park => park.id === lot.parkId);
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

        // Automatically hide the lot when a tenant is assigned
        try {
          const lot = await storage.getLot(tenantData.lotId);
          if (lot) {
            // Set the lot to hidden (isActive: false)
            await storage.updateLot(tenantData.lotId, {
              isActive: false
            });
            
            console.log(`Lot ${lot.nameOrNumber} automatically hidden due to tenant assignment`);
          }
        } catch (statusError) {
          console.error('Failed to hide lot:', statusError);
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
        try {
          // Use getLotAny to get the lot regardless of active status
          // This allows managers to update tenants even if the lot is occupied/inactive
          const lot = await storage.getLotAny(existingTenant.lotId);
          if (lot) {
            const assignments = await storage.getManagerAssignments(req.user!.id);
            const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
            if (!hasAccess) {
              return res.status(403).json({ message: 'Access denied to this Tenant' });
            }
          } else {
            // If lot doesn't exist at all, it may have been deleted
            console.warn(`Lot ${existingTenant.lotId} not found for tenant ${tenantId}`);
            // Allow the update to proceed - the tenant exists and the manager should be able to manage it
            // The lot reference will be maintained even if the lot is deleted
          }
        } catch (error) {
          console.error('Error checking lot access:', error);
          return res.status(500).json({ message: 'Error verifying lot access' });
        }
      }

      // For company managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MHP_LORD') {
        try {
          const lot = await storage.getLotAny(existingTenant.lotId);
          if (lot) {
            if (!req.user!.companyId) {
              return res.status(403).json({ message: 'Company manager must be assigned to a company' });
            }

            const companyParks = await storage.getParksByCompany(req.user!.companyId);
            const hasAccess = companyParks.parks.some(park => park.id === lot.parkId);
            if (!hasAccess) {
              return res.status(403).json({ message: 'Access denied to this Tenant' });
            }
          } else {
            console.warn(`Lot ${existingTenant.lotId} not found for tenant ${tenantId}`);
          }
        } catch (error) {
          console.error('Error checking lot access:', error);
          return res.status(500).json({ message: 'Error verifying lot access' });
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
        // Use getLotAny to get the lot regardless of active status
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // For company managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MHP_LORD') {
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }

        const companyParks = await storage.getParksByCompany(req.user!.companyId);
        const hasAccess = companyParks.parks.some(park => park.id === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // Store lot info before deleting tenant
      const lot = await storage.getLot(Tenant.lotId);
      
      await storage.deleteTenant(tenantId);
      
      // Make the lot visible again when tenant is deleted
      if (lot) {
        try {
          // Set the lot back to visible (isActive: true)
          await storage.updateLot(lot.id, {
            isActive: true
          });
          console.log(`Lot ${lot.nameOrNumber} made visible again after tenant deletion`);
        } catch (statusError) {
          console.error('Failed to make lot visible:', statusError);
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
      
      // For managers and company managers, filter by their assigned parks
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
      } else if (req.user!.role === 'MHP_LORD') {
        if (!req.user!.companyId) {
          return res.status(400).json({ message: 'Company manager must be assigned to a company' });
        }
        
        const companyParks = await storage.getParksByCompany(req.user!.companyId);
        const parkIds = companyParks.parks.map(p => p.id);
        
        if (parkIds.length === 0) {
          return res.json({ payments: [] });
        }
        
        // Get payments with Tenant info and filter by company's parks
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
        // Use getLotAny to get the lot regardless of active status
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      }

      // For company managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MHP_LORD') {
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }

        const companyParks = await storage.getParksByCompany(req.user!.companyId);
        const hasAccess = companyParks.parks.some(park => park.id === lot.parkId);
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

      // For managers and company managers, check if they have access to this Tenant's lot
      if (req.user!.role === 'MANAGER') {
        // Use getLotAny to get the lot regardless of active status
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        const assignments = await storage.getManagerAssignments(req.user!.id);
        const hasAccess = assignments.some(assignment => assignment.parkId === lot.parkId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied to this Tenant' });
        }
      } else if (req.user!.role === 'MHP_LORD') {
        const lot = await storage.getLotAny(Tenant.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }

        const park = await storage.getPark(lot.parkId);
        const hasAccess = park && park.companyId === req.user!.companyId;
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

      // For managers and company managers, check if they have access to this payment's lot
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
      } else if (req.user!.role === 'MHP_LORD') {
        const lot = await storage.getLot(existingPayment.lotId);
        if (!lot) {
          return res.status(404).json({ message: 'Associated lot not found' });
        }

        if (!req.user!.companyId) {
          return res.status(403).json({ message: 'Company manager must be assigned to a company' });
        }

        const park = await storage.getPark(lot.parkId);
        const hasAccess = park && park.companyId === req.user!.companyId;
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

  app.delete('/api/payments/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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

      // Check for manager's Google Calendar conflicts (ONLY source of truth for availability)
      try {
        if (await googleCalendarService.isCalendarConnected(managerId)) {
          console.log(`[Booking] Checking calendar conflicts for manager ${managerId} from ${startDt.toISOString()} to ${endDt.toISOString()}`);
          const hasCalendarConflict = await googleCalendarService.checkCalendarConflicts(managerId, startDt, endDt);
          if (hasCalendarConflict) {
            console.log(`[Booking] ❌ Calendar conflict detected - rejecting booking`);
            return res.status(409).json({ message: 'Time slot is not available - manager has a calendar conflict' });
          }
          console.log(`[Booking] ✅ No calendar conflicts - proceeding with booking`);
        } else {
          console.log(`[Booking] ⚠️ Manager calendar not connected - allowing booking without calendar check`);
        }
      } catch (error) {
        console.error('[Booking] Error checking calendar conflicts:', error);
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
        reminderPreference: bookingData.reminderPreference,
        status: 'SCHEDULED'
      });

      // Try to sync with Google Calendar
      let calendarEventId: string | null = null;
      let calendarHtmlLink: string | null = null;
      let calendarSyncError = false;

      try {
        // Check if manager has Google Calendar connected
        if (await googleCalendarService.isCalendarConnected(managerId)) {
          const event: any = {
            summary: `Property Showing - ${bookingData.clientName}`,
            description: `Property showing for ${lot.park.name} - Lot ${lot.nameOrNumber}\n\nClient: ${bookingData.clientName}\nEmail: ${bookingData.clientEmail || 'N/A'}\nPhone: ${bookingData.clientPhone || 'N/A'}\nReminder Preference: ${bookingData.reminderPreference}`,
            start: {
              dateTime: startDt.toISOString(),
              timeZone: 'UTC',
            },
            end: {
              dateTime: endDt.toISOString(),
              timeZone: 'UTC',
            }
          };
          
          // Only add attendees if email is provided
          if (bookingData.clientEmail && bookingData.clientEmail.trim() !== '') {
            event.attendees = [
              { email: bookingData.clientEmail, displayName: bookingData.clientName }
            ];
          }

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
            console.log(`Deleting calendar event ${updatedShowing.calendarEventId} for manager ${updatedShowing.managerId}`);
            // Check if manager still has calendar connected
            const isConnected = await googleCalendarService.isCalendarConnected(updatedShowing.managerId);
            if (isConnected) {
              await googleCalendarService.deleteCalendarEvent(updatedShowing.managerId, updatedShowing.calendarEventId);
              console.log('Calendar event deleted successfully');
            } else {
              console.log('Manager calendar not connected - skipping calendar deletion');
            }
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
        } catch (error: any) {
          console.error('Calendar sync error:', error);
          // Log more details about the error
          if (error?.message) {
            console.error('Error message:', error.message);
          }
          if (error?.code) {
            console.error('Error code:', error.code);
          }
          // Update showing with sync error but don't fail the request
          await storage.updateShowing(req.params.id, { calendarSyncError: true } as any);
        }
      }

      res.json(updatedShowing);
    } catch (error) {
      console.error('Update showing error:', error);
      res.status(400).json({ message: 'Invalid showing data' });
    }
  });

  // Cancel calendar event directly (for calendar-first approach)
  app.delete('/api/calendar/events/:eventId', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      console.log(`Attempting to delete calendar event ${eventId} for user ${userId}`);

      // Check if user has calendar connected
      const isConnected = await googleCalendarService.isCalendarConnected(userId);
      if (!isConnected) {
        return res.status(400).json({ message: 'Google Calendar not connected' });
      }

      // Delete the calendar event
      await googleCalendarService.deleteCalendarEvent(userId, eventId);

      // Also update the database if there's a corresponding showing
      try {
        const allShowings = await storage.getShowings({ managerId: userId });
        const dbShowing = allShowings.find(s => s.calendarEventId === eventId);
        if (dbShowing) {
          await storage.updateShowing(dbShowing.id, { status: 'CANCELED' as any });
          console.log(`Updated database showing ${dbShowing.id} to CANCELED`);
        }
      } catch (dbError) {
        console.log('Could not update database showing, but calendar event was deleted:', dbError);
        // Don't fail the request if database update fails
      }

      res.json({ message: 'Calendar event deleted successfully' });
    } catch (error: any) {
      console.error('Delete calendar event error:', error);
      res.status(500).json({ message: error?.message || 'Failed to delete calendar event' });
    }
  });

  // Complete calendar event directly (for calendar-first approach)
  app.patch('/api/calendar/events/:eventId/complete', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      console.log(`Attempting to mark calendar event ${eventId} as completed for user ${userId}`);

      // Check if user has calendar connected
      const isConnected = await googleCalendarService.isCalendarConnected(userId);
      if (!isConnected) {
        return res.status(400).json({ message: 'Google Calendar not connected' });
      }

      // Get the current event to update its title
      const calendar = await googleCalendarService.createCalendarClient(userId);
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId
      });

      // Update the event title to include COMPLETED
      let newSummary = currentEvent.data.summary || 'Property Showing';
      if (!newSummary.includes('COMPLETED')) {
        newSummary = `COMPLETED - ${newSummary}`;
      }

      // Update the calendar event
      await googleCalendarService.updateCalendarEvent(userId, eventId, {
        summary: newSummary,
        description: currentEvent.data.description,
        start: currentEvent.data.start,
        end: currentEvent.data.end,
        status: 'confirmed'
      });

      // Also update the database if there's a corresponding showing
      try {
        const allShowings = await storage.getShowings({ managerId: userId });
        const dbShowing = allShowings.find(s => s.calendarEventId === eventId);
        if (dbShowing) {
          await storage.updateShowing(dbShowing.id, { status: 'COMPLETED' as any });
          console.log(`Updated database showing ${dbShowing.id} to COMPLETED`);
        }
      } catch (dbError) {
        console.log('Could not update database showing, but calendar event was updated:', dbError);
        // Don't fail the request if database update fails
      }

      res.json({ message: 'Calendar event marked as completed successfully' });
    } catch (error: any) {
      console.error('Complete calendar event error:', error);
      res.status(500).json({ message: error?.message || 'Failed to mark calendar event as completed' });
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
  app.get('/api/admin/bookings', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
  app.put('/api/admin/bookings/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
  app.get('/api/admin/manager-assignments', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const assignments = await storage.getAllManagerAssignments();
      res.json(assignments);
    } catch (error) {
      console.error('Manager assignments error:', error);
      res.status(500).json({ message: 'Failed to fetch manager assignments' });
    }
  });

  // Create manager assignment
  app.post('/api/admin/manager-assignments', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
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
  app.delete('/api/admin/managers/:id/assignments', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      await storage.removeManagerAssignments(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Remove manager assignments error:', error);
      res.status(500).json({ message: 'Failed to remove assignments' });
    }
  });


  // Delete/remove manager
  app.delete('/api/admin/managers/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete manager error:', error);
      res.status(500).json({ message: 'Failed to delete manager' });
    }
  });

  // Get login logs (MHP_LORD only)
  app.get('/api/admin/login-logs', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const { userId, role, days, success, page, limit } = req.query;
      
      const filters: any = {};
      
      if (userId && typeof userId === 'string') {
        filters.userId = userId;
      }
      
      if (role && typeof role === 'string' && role !== 'all') {
        filters.role = role;
      }
      
      if (days && typeof days === 'string') {
        filters.days = parseInt(days, 10);
      }
      
      if (success !== undefined && success !== 'all') {
        filters.success = success === 'true';
      }
      
      if (page && typeof page === 'string') {
        filters.page = parseInt(page, 10);
      }
      
      if (limit && typeof limit === 'string') {
        filters.limit = parseInt(limit, 10);
      }
      
      const result = await storage.getLoginLogs(filters);
      res.json({ logs: result.logs, totalCount: result.totalCount });
    } catch (error) {
      console.error('Get login logs error:', error);
      res.status(500).json({ message: 'Failed to fetch login logs' });
    }
  });

  // Get all invites
  app.get('/api/auth/invites', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      const invites = await storage.getInvites();
      res.json({ invites });
    } catch (error) {
      console.error('Get invites error:', error);
      res.status(500).json({ message: 'Failed to fetch invites' });
    }
  });

  // Delete invite
  app.delete('/api/auth/invites/:id', authenticateToken, requireRole('MHP_LORD'), async (req, res) => {
    try {
      await storage.deleteInvite(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Delete invite error:', error);
      res.status(500).json({ message: 'Failed to delete invite' });
    }
  });

  // Photo reordering route (MUST be before /api/photos/:id routes)
  app.patch('/api/photos/reorder', authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Photo reorder request:', { 
        body: req.body, 
        user: { id: req.user?.id, role: req.user?.role, companyId: req.user?.companyId }
      });
      
      const { entityType, entityId, photoOrders } = req.body;

      if (!entityType || !entityId || !Array.isArray(photoOrders)) {
        console.log('Missing required fields:', { entityType, entityId, photoOrders });
        return res.status(400).json({ message: 'Missing required fields: entityType, entityId, photoOrders' });
      }

      // Validate entityType
      if (!['COMPANY', 'PARK', 'LOT'].includes(entityType)) {
        console.log('Invalid entity type:', entityType);
        return res.status(400).json({ message: 'Invalid entityType. Must be COMPANY, PARK, or LOT' });
      }

      // Check permissions based on entity type
      if (entityType === 'LOT') {
        // For lots, allow MHP_LORD (super admin), ADMIN (company manager), and MANAGER (park manager) with lot access
        console.log('Checking lot photo reorder permissions for role:', req.user?.role);
        
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can reorder any lot photos
          console.log('MHP_LORD: Access granted');
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can reorder lot photos in their company's parks
          console.log('ADMIN: Checking company access');
          
          if (!req.user.companyId) {
            console.log('ADMIN: No companyId assigned');
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const lot = await storage.getLotAny(entityId);
          if (!lot) {
            console.log('ADMIN: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          console.log('ADMIN: Lot found, parkId:', lot.parkId);
          
          // If lot has no park, deny access for company managers (only MHP_LORD can manage unassigned lots)
          if (!lot.parkId) {
            console.log('ADMIN: Lot not assigned to park');
            return res.status(403).json({ message: 'Access denied - lot not assigned to a park' });
          }
          
          const park = await storage.getPark(lot.parkId);
          console.log('ADMIN: Park found:', !!park, 'Park companyId:', park?.companyId, 'User companyId:', req.user.companyId);
          
          if (!park || park.companyId !== req.user.companyId) {
            console.log('ADMIN: Park does not belong to user company');
            return res.status(403).json({ message: 'Access denied to this lot' });
          }
          
          console.log('ADMIN: Access granted');
        } else if (req.user?.role === 'MANAGER') {
          // Park manager can reorder lot photos in parks they manage
          console.log('MANAGER: Checking park access');
          
          const lot = await storage.getLotAny(entityId);
          if (!lot) {
            console.log('MANAGER: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          // If lot has no park, deny access for managers (only MHP_LORD can manage unassigned lots)
          if (!lot.parkId) {
            console.log('MANAGER: Lot not assigned to park');
            return res.status(403).json({ message: 'Access denied - lot not assigned to a park' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          console.log('MANAGER: Has access to park:', hasAccess);
          
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied - you are not assigned to this park' });
          }
          
          console.log('MANAGER: Access granted');
        } else {
          console.log('Unknown role or access denied, role:', req.user?.role);
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (entityType === 'PARK') {
        // For park photos, allow admins and managers with park access
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can reorder any park photos
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this park
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === entityId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else if (req.user?.role === 'ADMIN') {
          // Check if company manager has access to this park
          if (!req.user.companyId) {
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const park = await storage.getPark(entityId);
          if (!park || park.companyId !== req.user.companyId) {
            return res.status(403).json({ message: 'Access denied to this park' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company photos, allow MHP_LORD (super admin) and ADMIN (company manager)
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can reorder any company photos
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can reorder their company's photos
          // Additional permission checks could be added here if needed
        } else {
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
      console.log('Calling storage.reorderPhotos with:', { entityType, entityId, photoOrders });
      await storage.reorderPhotos(entityType, entityId, photoOrders);
      
      // Return updated photos
      console.log('Getting updated photos...');
      const updatedPhotos = await storage.getPhotos(entityType, entityId);
      console.log('Photos reordered successfully, returning', updatedPhotos.length, 'photos');
      res.json(updatedPhotos);
    } catch (error) {
      console.error('Reorder photos error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Delete photo (works for all entity types)
  app.delete('/api/photos/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Delete photo request for ID:', req.params.id);
      console.log('User role:', req.user?.role);
      
      // Get photo information to check permissions
      const photo = await storage.getPhoto(req.params.id);
      console.log('Photo found:', !!photo);
      if (!photo) {
        console.log('Photo not found in database');
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      console.log('Photo details:', {
        entityType: photo.entityType,
        entityId: photo.entityId,
        urlOrPath: photo.urlOrPath
      });

      // Check permissions based on entity type
      if (photo.entityType === 'LOT') {
        // For lots, allow MHP_LORD (super admin), ADMIN (company manager), and MANAGER (park manager) with lot access
        console.log('Checking lot photo deletion permissions for role:', req.user?.role);
        
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can delete any lot photo
          console.log('MHP_LORD: Access granted');
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can delete lot photos in their company's parks
          console.log('ADMIN: Checking company access');
          
          if (!req.user.companyId) {
            console.log('ADMIN: No companyId assigned');
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            console.log('ADMIN: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          console.log('ADMIN: Lot found, parkId:', lot.parkId);
          
          // If lot has no park, allow access for company managers to manage unassigned lots
          if (!lot.parkId) {
            console.log('ADMIN: Lot not assigned to park');
            // Allow ADMIN to manage photos for unassigned lots
            console.log('ADMIN: Access granted for unassigned lot');
          } else {
            const park = await storage.getPark(lot.parkId);
            console.log('ADMIN: Park found:', !!park, 'Park companyId:', park?.companyId, 'User companyId:', req.user.companyId);
            
            if (!park || park.companyId !== req.user.companyId) {
              console.log('ADMIN: Park does not belong to user company');
              return res.status(403).json({ message: 'Access denied to this lot' });
            }
            
            console.log('ADMIN: Access granted');
          }
        } else if (req.user?.role === 'MANAGER') {
          // Park manager can delete lot photos in parks they manage
          console.log('MANAGER: Checking park access');
          
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            console.log('MANAGER: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          // If lot has no park, deny access for managers (only MHP_LORD can manage unassigned lots)
          if (!lot.parkId) {
            console.log('MANAGER: Lot not assigned to park');
            return res.status(403).json({ message: 'Access denied - lot not assigned to a park' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          console.log('MANAGER: Has access to park:', hasAccess);
          
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied - you are not assigned to this park' });
          }
          
          console.log('MANAGER: Access granted');
        } else {
          console.log('Unknown role or access denied, role:', req.user?.role);
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (photo.entityType === 'PARK') {
        // For park photos, allow admins, managers, and company managers with park access
        if (req.user?.role === 'MHP_LORD') {
          // Admin can delete any park photo
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this park
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === photo.entityId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied - you are not assigned to this park' });
          }
        } else if (req.user?.role === 'ADMIN') {
          // Check if company manager has access to this park
          if (!req.user.companyId) {
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const park = await storage.getPark(photo.entityId);
          if (!park || park.companyId !== req.user.companyId) {
            return res.status(403).json({ message: 'Access denied to this park' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company photos, allow MHP_LORD (super admin) and ADMIN (company manager)
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can delete any company photo
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can delete their company's photos
          if (!req.user.companyId) {
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          if (photo.entityId !== req.user.companyId) {
            return res.status(403).json({ message: 'Access denied - you can only delete your own company photos' });
          }
        } else {
          return res.status(403).json({ message: 'Admin access required' });
        }
      }

      console.log('Permission checks passed, proceeding with deletion');

      // Extract S3 key from URL and delete from S3
      const s3Key = extractS3KeyFromUrl(photo.urlOrPath);
      if (s3Key) {
        try {
          console.log('Deleting photo from S3:', s3Key);
          await deleteFromS3(s3Key);
          console.log('Photo deleted successfully from S3');
        } catch (s3Error) {
          console.error('Failed to delete from S3 (continuing with DB deletion):', s3Error);
          // Continue with database deletion even if S3 deletion fails
        }
      } else {
        console.log('Photo not stored in S3 or legacy format, skipping S3 deletion');
      }

      console.log('Deleting photo from database');
      await storage.deletePhoto(req.params.id);
      console.log('Photo deleted successfully from database');
      res.status(204).send();
    } catch (error) {
      console.error('Delete photo error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        photoId: req.params.id
      });
      res.status(500).json({ 
        message: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        // For lots, allow MHP_LORD (super admin), ADMIN (company manager), and MANAGER (park manager) with lot access
        console.log('Checking lot photo caption update permissions for role:', req.user?.role);
        
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can update any lot photo
          console.log('MHP_LORD: Access granted');
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can update lot photos in their company's parks
          console.log('ADMIN: Checking company access');
          
          if (!req.user.companyId) {
            console.log('ADMIN: No companyId assigned');
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            console.log('ADMIN: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          console.log('ADMIN: Lot found, parkId:', lot.parkId);
          
          // If lot has no park, allow access for company managers to manage unassigned lots
          if (!lot.parkId) {
            console.log('ADMIN: Lot not assigned to park');
            // Allow ADMIN to manage photos for unassigned lots
            console.log('ADMIN: Access granted for unassigned lot');
          } else {
            const park = await storage.getPark(lot.parkId);
            console.log('ADMIN: Park found:', !!park, 'Park companyId:', park?.companyId, 'User companyId:', req.user.companyId);
            
            if (!park || park.companyId !== req.user.companyId) {
              console.log('ADMIN: Park does not belong to user company');
              return res.status(403).json({ message: 'Access denied to this lot' });
            }
            
            console.log('ADMIN: Access granted');
          }
        } else if (req.user?.role === 'MANAGER') {
          // Park manager can update lot photos in parks they manage
          console.log('MANAGER: Checking park access');
          
          const lot = await storage.getLotAny(photo.entityId);
          if (!lot) {
            console.log('MANAGER: Lot not found');
            return res.status(404).json({ message: 'Lot not found' });
          }
          
          // If lot has no park, deny access for managers (only MHP_LORD can manage unassigned lots)
          if (!lot.parkId) {
            console.log('MANAGER: Lot not assigned to park');
            return res.status(403).json({ message: 'Access denied - lot not assigned to a park' });
          }
          
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === lot.parkId);
          console.log('MANAGER: Has access to park:', hasAccess);
          
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied - you are not assigned to this park' });
          }
          
          console.log('MANAGER: Access granted');
        } else {
          console.log('Unknown role or access denied, role:', req.user?.role);
          return res.status(403).json({ message: 'Access denied' });
        }
      } else if (photo.entityType === 'PARK') {
        // For park photos, allow admins, managers, and company managers with park access
        if (req.user?.role === 'MHP_LORD') {
          // Admin can update any park photo
        } else if (req.user?.role === 'MANAGER') {
          // Check if manager has access to this park
          const assignments = await storage.getManagerAssignments(req.user.id);
          const hasAccess = assignments.some((assignment: any) => assignment.parkId === photo.entityId);
          if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
          }
        } else if (req.user?.role === 'ADMIN') {
          // Check if company manager has access to this park
          if (!req.user.companyId) {
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          const park = await storage.getPark(photo.entityId);
          if (!park || park.companyId !== req.user.companyId) {
            return res.status(403).json({ message: 'Access denied to this park' });
          }
        } else {
          return res.status(403).json({ message: 'Access denied' });
        }
      } else {
        // For company photos, allow MHP_LORD (super admin) and ADMIN (company manager)
        if (req.user?.role === 'MHP_LORD') {
          // Super admin can update any company photo
        } else if (req.user?.role === 'ADMIN') {
          // Company manager can update their company's photos
          if (!req.user.companyId) {
            return res.status(403).json({ message: 'Company manager must be assigned to a company' });
          }
          
          if (photo.entityId !== req.user.companyId) {
            return res.status(403).json({ message: 'Access denied - you can only update your own company photos' });
          }
        } else {
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

  // ===== CRM ROUTES (ACCESSIBLE TO ALL AUTHENTICATED USERS) =====
  
  // CRM Contacts
  app.get('/api/crm/contacts', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const { q } = req.query;
      const contacts = await storage.getCrmContacts(companyId, { q: q as string });
      res.json({ contacts });
    } catch (error) {
      console.error('Get CRM contacts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/crm/contacts/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      // Verify access
      if (contact.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(contact);
    } catch (error) {
      console.error('Get CRM contact error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/contacts', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const contactData = {
        ...req.body,
        companyId,
        createdBy: req.user!.id
      };

      const contact = await storage.createCrmContact(contactData);
      
      // Log activity
      await storage.createCrmActivity({
        type: 'CREATED',
        description: `Contact created: ${contact.firstName} ${contact.lastName}`,
        entityType: 'CONTACT',
        entityId: contact.id,
        userId: req.user!.id,
        companyId
      });

      res.json(contact);
    } catch (error) {
      console.error('Create CRM contact error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/crm/contacts/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      if (contact.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updated = await storage.updateCrmContact(req.params.id, req.body);
      
      // Log activity
      await storage.createCrmActivity({
        type: 'UPDATED',
        description: `Contact updated`,
        entityType: 'CONTACT',
        entityId: updated.id,
        userId: req.user!.id,
        companyId: contact.companyId
      });

      res.json(updated);
    } catch (error) {
      console.error('Update CRM contact error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/crm/contacts/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: 'Contact not found' });
      }

      if (contact.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteCrmContact(req.params.id);
      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      console.error('Delete CRM contact error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Deals
  app.get('/api/crm/deals', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const { stage, assignedTo, contactId } = req.query;
      const deals = await storage.getCrmDeals(companyId, {
        stage: stage as string,
        assignedTo: assignedTo as string,
        contactId: contactId as string
      });
      
      res.json({ deals });
    } catch (error) {
      console.error('Get CRM deals error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/crm/deals/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      if (deal.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(deal);
    } catch (error) {
      console.error('Get CRM deal error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/deals', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const dealData = {
        ...req.body,
        companyId,
        createdBy: req.user!.id
      };

      const deal = await storage.createCrmDeal(dealData);
      
      // Log activity
      await storage.createCrmActivity({
        type: 'CREATED',
        description: `Deal created: ${deal.title}`,
        entityType: 'DEAL',
        entityId: deal.id,
        userId: req.user!.id,
        companyId
      });

      res.json(deal);
    } catch (error) {
      console.error('Create CRM deal error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/crm/deals/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      if (deal.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const oldStage = deal.stage;
      const updated = await storage.updateCrmDeal(req.params.id, req.body);
      
      // Log activity
      if (req.body.stage && req.body.stage !== oldStage) {
        await storage.createCrmActivity({
          type: 'STAGE_CHANGED',
          description: `Deal stage changed from ${oldStage} to ${req.body.stage}`,
          entityType: 'DEAL',
          entityId: updated.id,
          userId: req.user!.id,
          companyId: deal.companyId
        });
      } else {
        await storage.createCrmActivity({
          type: 'UPDATED',
          description: `Deal updated`,
          entityType: 'DEAL',
          entityId: updated.id,
          userId: req.user!.id,
          companyId: deal.companyId
        });
      }

      res.json(updated);
    } catch (error) {
      console.error('Update CRM deal error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/crm/deals/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }

      if (deal.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteCrmDeal(req.params.id);
      res.json({ message: 'Deal deleted successfully' });
    } catch (error) {
      console.error('Delete CRM deal error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Tasks
  app.get('/api/crm/tasks', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const { assignedTo, status, entityType, entityId } = req.query;
      const tasks = await storage.getCrmTasks(companyId, {
        assignedTo: assignedTo as string,
        status: status as string,
        entityType: entityType as string,
        entityId: entityId as string
      });
      
      // Enrich tasks with entity information
      const enrichedTasks = await Promise.all(tasks.map(async (task) => {
        let entityName = null;
        
        if (task.entityType && task.entityId) {
          try {
            if (task.entityType === 'CONTACT') {
              const contact = await storage.getCrmContact(task.entityId);
              if (contact) {
                entityName = `${contact.firstName} ${contact.lastName}`;
              }
            } else if (task.entityType === 'DEAL') {
              const deal = await storage.getCrmDeal(task.entityId);
              if (deal) {
                entityName = deal.title;
              }
            }
          } catch (error) {
            console.error(`Error fetching entity ${task.entityType} ${task.entityId}:`, error);
          }
        }
        
        return {
          ...task,
          entityName
        };
      }));
      
      res.json({ tasks: enrichedTasks });
    } catch (error) {
      console.error('Get CRM tasks error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/tasks', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const taskData = {
        ...req.body,
        companyId,
        createdBy: req.user!.id
      };

      console.log('Creating task with data:', JSON.stringify(taskData, null, 2));
      const task = await storage.createCrmTask(taskData);
      console.log('Task created successfully:', task.id);
      
      // Log activity if task is associated with an entity
      if (task.entityType && task.entityId) {
        await storage.createCrmActivity({
          type: 'TASK_ADDED',
          description: `Task created: ${task.title}`,
          entityType: task.entityType,
          entityId: task.entityId,
          userId: req.user!.id,
          companyId
        });
      }

      // Emit WebSocket event to assigned user for real-time notification
      const io = app.get('socketIo');
      if (io && task.assignedTo) {
        io.to(`user:${task.assignedTo}`).emit('task_updated', {
          taskId: task.id,
          action: 'created'
        });
      }

      res.json(task);
    } catch (error) {
      console.error('Create CRM task error:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch('/api/crm/tasks/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const task = await storage.getCrmTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      if (task.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const oldStatus = task.status;
      const oldAssignedTo = task.assignedTo;
      const updated = await storage.updateCrmTask(req.params.id, req.body);
      
      // Log activity if status changed and task is associated with an entity
      if (req.body.status && req.body.status !== oldStatus && task.entityType && task.entityId) {
        await storage.createCrmActivity({
          type: 'STATUS_CHANGED',
          description: `Task "${task.title}" status changed from ${oldStatus} to ${req.body.status}`,
          entityType: task.entityType,
          entityId: task.entityId,
          userId: req.user!.id,
          companyId: task.companyId
        });
      }

      // Emit WebSocket event to assigned users for real-time notification
      const io = app.get('socketIo');
      if (io) {
        // Notify old assignee if changed
        if (req.body.assignedTo && req.body.assignedTo !== oldAssignedTo && oldAssignedTo) {
          io.to(`user:${oldAssignedTo}`).emit('task_updated', {
            taskId: task.id,
            action: 'unassigned'
          });
        }
        // Notify new assignee
        if (updated.assignedTo) {
          io.to(`user:${updated.assignedTo}`).emit('task_updated', {
            taskId: updated.id,
            action: 'updated'
          });
        }
      }

      res.json(updated);
    } catch (error) {
      console.error('Update CRM task error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/crm/tasks/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const task = await storage.getCrmTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }

      if (task.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteCrmTask(req.params.id);
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Delete CRM task error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Notes
  app.get('/api/crm/notes', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { entityType, entityId } = req.query;
      if (!entityType || !entityId) {
        return res.status(400).json({ message: 'entityType and entityId are required' });
      }

      const notes = await storage.getCrmNotes(entityType as string, entityId as string);
      res.json({ notes });
    } catch (error) {
      console.error('Get CRM notes error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/notes', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const noteData = {
        ...req.body,
        companyId,
        createdBy: req.user!.id
      };

      const note = await storage.createCrmNote(noteData);
      
      // Log activity
      await storage.createCrmActivity({
        type: 'NOTE_ADDED',
        description: `Note added`,
        entityType: note.entityType,
        entityId: note.entityId,
        userId: req.user!.id,
        companyId
      });

      // Emit WebSocket event to mentioned users
      if (note.mentionedUsers && note.mentionedUsers.length > 0) {
        const io = app.get('socketIo');
        if (io) {
          note.mentionedUsers.forEach((userId: string) => {
            io.to(`user:${userId}`).emit('note_mention', {
              noteId: note.id,
              entityType: note.entityType,
              entityId: note.entityId,
              mentionedBy: req.user!.fullName,
            });
          });
        }
      }

      res.json(note);
    } catch (error) {
      console.error('Create CRM note error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/crm/notes/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const note = await storage.getCrmNote(req.params.id);
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }

      if (note.companyId !== req.user!.companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteCrmNote(req.params.id);
      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Delete CRM note error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Activities
  app.get('/api/crm/activities', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { entityType, entityId } = req.query;
      if (!entityType || !entityId) {
        return res.status(400).json({ message: 'entityType and entityId are required' });
      }

      const activities = await storage.getCrmActivities(entityType as string, entityId as string);
      res.json({ activities });
    } catch (error) {
      console.error('Get CRM activities error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Messages
  app.get('/api/crm/messages', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { otherUserId } = req.query;
      const messages = await storage.getCrmMessages(req.user!.id, otherUserId as string);
      res.json({ messages });
    } catch (error) {
      console.error('Get CRM messages error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/crm/messages/unread-count', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const count = await storage.getUnreadMessageCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error('Get unread message count error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/messages/mark-all-read', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.markAllMessagesAsRead(req.user!.id);
      res.json({ message: 'All messages marked as read' });
    } catch (error) {
      console.error('Mark all messages as read error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/crm/conversations', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const conversations = await storage.getConversations(req.user!.id);
      res.json({ conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/crm/notifications', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const notifications = await storage.getNotifications(req.user!.id, companyId);
      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/notifications/clear-tasks', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearTaskNotifications(req.user!.id);
      
      // Emit WebSocket event for real-time update
      const io = app.get('socketIo');
      if (io) {
        io.to(`user:${req.user!.id}`).emit('task_notifications_cleared');
      }
      
      res.json({ message: 'Task notifications cleared' });
    } catch (error) {
      console.error('Clear task notifications error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/notifications/clear-mentions', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.clearMentionNotifications(req.user!.id);
      
      // Emit WebSocket event for real-time update
      const io = app.get('socketIo');
      if (io) {
        io.to(`user:${req.user!.id}`).emit('mention_notifications_cleared');
      }
      
      res.json({ message: 'Mention notifications cleared' });
    } catch (error) {
      console.error('Clear mention notifications error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Associations
  app.get('/api/crm/associations', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sourceType, sourceId } = req.query;
      if (!sourceType || !sourceId) {
        return res.status(400).json({ message: 'sourceType and sourceId are required' });
      }

      const associations = await storage.getCrmAssociations(sourceType as string, sourceId as string);
      res.json({ associations });
    } catch (error) {
      console.error('Get CRM associations error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/crm/associations', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const { sourceType, sourceId, targetType, targetId } = req.body;
      
      // Validate required fields
      if (!sourceType || !sourceId || !targetType || !targetId) {
        return res.status(400).json({ 
          message: 'Missing required fields: sourceType, sourceId, targetType, and targetId are required' 
        });
      }

      const associationData = {
        ...req.body,
        companyId,
        createdBy: req.user!.id
      };

      const association = await storage.createCrmAssociation(associationData);
      
      // Log activity for both sides of the association (bidirectional)
      await storage.createCrmActivity({
        type: 'ASSOCIATION_ADDED',
        description: `Associated ${association.targetType} with ${association.sourceType}`,
        entityType: association.sourceType,
        entityId: association.sourceId,
        userId: req.user!.id,
        companyId
      });

      // Log activity for the reverse side
      await storage.createCrmActivity({
        type: 'ASSOCIATION_ADDED',
        description: `Associated ${association.sourceType} with ${association.targetType}`,
        entityType: association.targetType,
        entityId: association.targetId,
        userId: req.user!.id,
        companyId
      });

      res.json(association);
    } catch (error) {
      console.error('Create CRM association error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ message: errorMessage });
    }
  });

  app.delete('/api/crm/associations/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await storage.deleteCrmAssociation(req.params.id);
      res.json({ message: 'Association deleted successfully' });
    } catch (error) {
      console.error('Delete CRM association error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get company users for CRM messaging
  app.get('/api/crm/company-users', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      const users = await storage.getUsers();
      const companyUsers = users.filter(u => u.companyId === companyId && u.isActive);
      
      // Return users without sensitive data
      const safeUsers = companyUsers.map(u => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role
      }));

      res.json({ users: safeUsers });
    } catch (error) {
      console.error('Get company users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRM Units (Lots in CRM context)
  app.get('/api/crm/units', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const companyId = req.user!.companyId;
      if (!companyId) {
        return res.status(403).json({ message: 'User must be assigned to a company' });
      }

      // Get company parks then get their lots
      const { parks } = await storage.getParksByCompany(companyId);
      const parkIds = parks.map(p => p.id);
      
      // Create a map of parkId to park name
      const parkMap = new Map(parks.map(p => [p.id, p.name]));
      
      let lots = [];
      for (const parkId of parkIds) {
        const parkLots = await storage.getLots({ parkId });
        // Enrich each lot with park name
        const enrichedLots = parkLots.map(lot => ({
          ...lot,
          parkName: parkMap.get(lot.parkId || '') || null
        }));
        lots.push(...enrichedLots);
      }

      res.json({ units: lots });
    } catch (error) {
      console.error('Get CRM units error:', error);
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
      // Use getLotAny to get the lot even if it's hidden (isActive = false)
      // Tenants should always be able to see their assigned lot
      const lot = await storage.getLotAny(tenant.lotId);
      if (!lot) {
        return res.status(404).json({ message: 'Associated lot not found' });
      }
      
      // Use getParkAny to get the park even if it's hidden (isActive = false)
      // Tenants should always be able to see the park their lot belongs to
      const park = await storage.getParkAny(lot.parkId);
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
  
  // Setup Socket.IO for real-time messaging
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await storage.getUser(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`User connected: ${user.fullName} (${user.id})`);

    // Join user to their own room
    socket.join(`user:${user.id}`);

    // Handle sending messages
    socket.on('send_message', async (data: { receiverId: string; content: string }) => {
      try {
        const message = await storage.createCrmMessage({
          senderId: user.id,
          receiverId: data.receiverId,
          content: data.content,
          companyId: user.companyId!
        });

        // Send to receiver
        io.to(`user:${data.receiverId}`).emit('new_message', message);
        
        // Send back to sender (for confirmation)
        socket.emit('message_sent', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data: { receiverId: string }) => {
      io.to(`user:${data.receiverId}`).emit('user_typing', { userId: user.id });
    });

    // Handle stop typing
    socket.on('stop_typing', (data: { receiverId: string }) => {
      io.to(`user:${data.receiverId}`).emit('user_stop_typing', { userId: user.id });
    });

    // Handle mark message as read
    socket.on('mark_read', async (data: { messageId: string }) => {
      try {
        await storage.markMessageAsRead(data.messageId);
        const message = await storage.getCrmMessage(data.messageId);
        if (message) {
          io.to(`user:${message.senderId}`).emit('message_read', { messageId: data.messageId });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.fullName} (${user.id})`);
    });
  });

  // Store io instance for use in routes
  app.set('socketIo', io);

  return httpServer;
}
