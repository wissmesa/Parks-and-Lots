import { google } from 'googleapis';
import { storage } from './storage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}/api/auth/google/callback`
  : 'http://localhost:5000/api/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

export class GoogleCalendarService {
  private oauth2Client: any;

  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth2 credentials not configured');
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  generateAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: state,
      prompt: 'consent' // Forces consent screen to get refresh token
    });
  }

  async exchangeCodeForTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async refreshTokens(refreshToken: string) {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { tokens } = await this.oauth2Client.refreshAccessToken();
    return tokens;
  }

  async storeTokens(userId: string, tokens: any) {
    const expiresAt = new Date(tokens.expiry_date || Date.now() + 3600 * 1000);
    
    // Get existing token data to preserve refresh token if new one isn't provided
    const existingToken = await storage.getGoogleCalendarToken(userId);
    
    // Use new refresh token if provided, otherwise keep existing one
    const refreshToken = tokens.refresh_token || existingToken?.refreshToken;
    
    if (!refreshToken) {
      throw new Error('No refresh token available and none provided in new tokens');
    }
    
    await storage.createOrUpdateGoogleCalendarToken(userId, {
      userId,
      accessToken: tokens.access_token,
      refreshToken,
      expiresAt,
      scope: SCOPES.join(' '),
      tokenType: tokens.token_type || 'Bearer'
    });
  }

  async getValidAccessToken(userId: string): Promise<string | null> {
    const tokenData = await storage.getGoogleCalendarToken(userId);
    
    if (!tokenData) {
      return null;
    }

    // Check if token is expired
    if (new Date() >= new Date(tokenData.expiresAt)) {
      try {
        // Try to refresh token
        if (!tokenData.refreshToken) {
          throw new Error('No refresh token available for token refresh');
        }
        const newTokens = await this.refreshTokens(tokenData.refreshToken);
        await this.storeTokens(userId, newTokens);
        return newTokens.access_token;
      } catch (error) {
        console.error('Failed to refresh Google Calendar token:', error);
        // Remove invalid token
        await storage.deleteGoogleCalendarToken(userId);
        return null;
      }
    }

    return tokenData.accessToken;
  }

  async createCalendarClient(userId: string) {
    const accessToken = await this.getValidAccessToken(userId);
    
    if (!accessToken) {
      throw new Error('No valid Google Calendar access token found');
    }

    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  async getUserCalendarEvents(userId: string, timeMin?: Date, timeMax?: Date) {
    const calendar = await this.createCalendarClient(userId);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin?.toISOString() || new Date().toISOString(),
      timeMax: timeMax?.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.data.items || [];
  }

  async createCalendarEvent(userId: string, event: any) {
    const calendar = await this.createCalendarClient(userId);
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });

    return response.data;
  }

  async updateCalendarEvent(userId: string, eventId: string, event: any) {
    const calendar = await this.createCalendarClient(userId);
    
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event
    });

    return response.data;
  }

  async deleteCalendarEvent(userId: string, eventId: string) {
    const calendar = await this.createCalendarClient(userId);
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });
  }

  async isCalendarConnected(userId: string): Promise<boolean> {
    const accessToken = await this.getValidAccessToken(userId);
    return accessToken !== null;
  }

  async disconnectCalendar(userId: string): Promise<void> {
    await storage.deleteGoogleCalendarToken(userId);
  }

  async checkCalendarConflicts(userId: string, startTime: Date, endTime: Date): Promise<boolean> {
    try {
      const calendar = await this.createCalendarClient(userId);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      
      // Check for any events during the requested time slot
      return events.length > 0;
    } catch (error) {
      console.error('Error checking calendar conflicts:', error);
      // If calendar check fails, assume no conflicts to allow booking
      return false;
    }
  }

  async getManagerCalendarEvents(userId: string, startDate: Date, endDate: Date) {
    try {
      const calendar = await this.createCalendarClient(userId);
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();