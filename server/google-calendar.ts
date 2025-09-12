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
    
    const res = await this.oauth2Client.refreshAccessToken();
    return res.credentials; // Tokens are under 'credentials', not 'tokens'
  }

  async storeTokens(userId: string, tokens: any) {
    if (!tokens) {
      throw new Error('No tokens provided to storeTokens function');
    }
    
    if (!tokens.access_token) {
      throw new Error('Invalid tokens: missing access_token');
    }
    
    // Handle both expiry_date (ms timestamp) and expires_in (seconds from now)
    let expiresAt: Date;
    if (tokens.expiry_date) {
      expiresAt = new Date(tokens.expiry_date);
    } else if (tokens.expires_in) {
      expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    } else {
      // Default to 1 hour from now
      console.log('No expiry info found in tokens, using default 1 hour');
      expiresAt = new Date(Date.now() + 3600 * 1000);
    }
    
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

  async getValidAccessToken(userId: string, retryCount = 0): Promise<string | null> {
    const tokenData = await storage.getGoogleCalendarToken(userId);
    
    if (!tokenData) {
      return null;
    }

    // If token is not expired, return it
    if (new Date() < new Date(tokenData.expiresAt)) {
      return tokenData.accessToken;
    }

    // Token is expired, attempt refresh with retry logic
    if (retryCount >= 2) {
      console.error('Max refresh retries exceeded for user', userId);
      return null;
    }

    try {
      // Try to refresh token
      if (!tokenData.refreshToken) {
        throw new Error('No refresh token available for token refresh');
      }
      console.log(`Refreshing expired token for user ${userId} (attempt ${retryCount + 1}/2)`);
      const newTokens = await this.refreshTokens(tokenData.refreshToken);
      await this.storeTokens(userId, newTokens);
      console.log(`Successfully refreshed token for user ${userId}`);
      return newTokens.access_token;
    } catch (error: any) {
        console.error('Failed to refresh Google Calendar token:', error);
        
        // Only delete tokens if the refresh token itself is invalid
        // Don't delete on network errors or temporary API failures
        const data = error?.response?.data || {};
        const errStr = [data.error, data.error_description, error?.message].filter(Boolean).join(' ').toLowerCase();
        const isInvalidRefreshToken = 
          data.error === 'invalid_grant' ||
          data.error === 'invalid_request' ||
          errStr.includes('invalid_grant') || 
          errStr.includes('invalid_request') || 
          errStr.includes('token has been expired') || 
          errStr.includes('revoked') ||
          (error?.status === 400 && errStr.includes('expired or revoked'));
          
        // Log sanitized error info for debugging (without tokens)
        console.log('Token refresh error analysis:', {
          userId: userId.substring(0, 8) + '...',
          errorType: data.error || 'unknown',
          isInvalid: isInvalidRefreshToken,
          retryCount
        });
          
        if (isInvalidRefreshToken) {
          console.log('Refresh token is invalid, removing token data');
          await storage.deleteGoogleCalendarToken(userId);
        } else {
          console.log('Temporary error refreshing token, keeping token data for retry');
        }
        
        // For temporary failures, retry once more
        if (!isInvalidRefreshToken && retryCount === 0) {
          console.log(`Retrying token refresh for user ${userId} after temporary error`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return this.getValidAccessToken(userId, retryCount + 1);
        }
        
        return null;
      }
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
    
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });

      return response.data;
    } catch (error: any) {
      // Check if this is a calendar conflict error
      if (error.code === 409 || 
          (error.message && error.message.toLowerCase().includes('conflict')) ||
          (error.message && error.message.toLowerCase().includes('busy'))) {
        throw new Error('CALENDAR_CONFLICT');
      }
      // Re-throw other errors as-is
      throw error;
    }
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
    // Check if a refresh token exists in storage (indicates connection status)
    // Don't rely on live refresh attempts to avoid false negatives during temporary failures
    const tokenData = await storage.getGoogleCalendarToken(userId);
    return !!(tokenData && tokenData.refreshToken);
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

  async getManagerBusySlots(userId: string, startDate: Date, endDate: Date): Promise<Array<{ start: string; end: string }>> {
    try {
      const calendar = await this.createCalendarClient(userId);
      
      console.log(`[Google Calendar] Fetching busy slots for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // First, let's see what calendars this user has access to
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items || [];
      console.log(`[Google Calendar] Found ${calendars.length} calendars for user ${userId}:`, 
        calendars.map(cal => ({ id: cal.id, summary: cal.summary, primary: cal.primary })));
      
      // Query all calendars the user has access to, not just primary
      const calendarIds = calendars
        .filter(cal => cal.accessRole === 'owner' || cal.accessRole === 'reader')
        .map(cal => ({ id: cal.id! }));
      
      console.log(`[Google Calendar] Querying ${calendarIds.length} calendars for busy times`);
      
      // Use FreeBusy API for more reliable availability data
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: calendarIds.length > 0 ? calendarIds : [{ id: 'primary' }]
        }
      });

      console.log(`[Google Calendar] FreeBusy API response:`, JSON.stringify(response.data, null, 2));
      
      // Collect busy slots from all calendars
      const allBusySlots: Array<{ start: string; end: string }> = [];
      
      if (response.data.calendars) {
        for (const [calendarId, calendarData] of Object.entries(response.data.calendars)) {
          const busySlots = calendarData.busy || [];
          console.log(`[Google Calendar] Calendar ${calendarId} has ${busySlots.length} busy slots:`, busySlots);
          
          allBusySlots.push(...busySlots.map(slot => ({
            start: slot.start!,
            end: slot.end!
          })));
        }
      }
      
      console.log(`[Google Calendar] Total busy slots found: ${allBusySlots.length}`, allBusySlots);
      return allBusySlots;
      
    } catch (error) {
      console.error('Error fetching manager busy slots:', error);
      // Fallback to events.list with better filtering
      return this.getManagerBusySlotsFromEvents(userId, startDate, endDate);
    }
  }

  private async getManagerBusySlotsFromEvents(userId: string, startDate: Date, endDate: Date): Promise<Array<{ start: string; end: string }>> {
    try {
      const calendar = await this.createCalendarClient(userId);
      
      console.log(`[Google Calendar Fallback] Fetching events directly for user ${userId}`);
      
      // Get calendar list for fallback method too
      const calendarListResponse = await calendar.calendarList.list();
      const calendars = calendarListResponse.data.items || [];
      
      const allBusySlots: Array<{ start: string; end: string }> = [];
      
      // Query events from all accessible calendars
      for (const cal of calendars) {
        if (cal.accessRole === 'owner' || cal.accessRole === 'reader') {
          try {
            console.log(`[Google Calendar Fallback] Querying calendar ${cal.id} (${cal.summary})`);
            
            const response = await calendar.events.list({
              calendarId: cal.id!,
              timeMin: startDate.toISOString(),
              timeMax: endDate.toISOString(),
              singleEvents: true,
              orderBy: 'startTime'
            });

            const events = response.data.items || [];
            console.log(`[Google Calendar Fallback] Found ${events.length} events in calendar ${cal.summary}:`, 
              events.map(e => ({ summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, status: e.status, transparency: e.transparency })));
            
            // Better filtering for events
            const calendarBusySlots = events
              .filter(event => {
                // Include only confirmed and tentative events
                if (!['confirmed', 'tentative'].includes(event.status || '')) {
                  console.log(`[Google Calendar Fallback] Skipping event ${event.summary} - status: ${event.status}`);
                  return false;
                }
                
                // Exclude transparent events (they don't block time)
                if (event.transparency === 'transparent') {
                  console.log(`[Google Calendar Fallback] Skipping event ${event.summary} - transparent`);
                  return false;
                }
                
                // Must have valid start and end times (dateTime not date for all-day events)
                if (!event.start?.dateTime || !event.end?.dateTime) {
                  console.log(`[Google Calendar Fallback] Skipping event ${event.summary} - no dateTime (might be all-day)`);
                  return false;
                }
                
                console.log(`[Google Calendar Fallback] Including event ${event.summary} as busy slot`);
                return true;
              })
              .map(event => ({
                start: event.start!.dateTime!,
                end: event.end!.dateTime!
              }));
            
            allBusySlots.push(...calendarBusySlots);
          } catch (calError) {
            console.error(`[Google Calendar Fallback] Error fetching events from calendar ${cal.id}:`, calError);
          }
        }
      }
      
      console.log(`[Google Calendar Fallback] Total busy slots from all calendars: ${allBusySlots.length}`, allBusySlots);
      return allBusySlots;
    } catch (error) {
      console.error('Error fetching events as fallback:', error);
      return [];
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();