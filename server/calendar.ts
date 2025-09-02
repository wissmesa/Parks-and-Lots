import { google } from 'googleapis';
import { storage } from './storage';
import type { Showing, OAuthAccount } from '@shared/schema';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export class CalendarService {
  private getOAuth2Client() {
    return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  getAuthUrl(): string {
    const oauth2Client = this.getOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async handleCallback(code: string, userId: string): Promise<OAuthAccount> {
    const oauth2Client = this.getOAuth2Client();
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      const account = await storage.createOrUpdateOAuthAccount(userId, {
        provider: 'google',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        externalCalendarId: 'primary'
      });

      return account;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to connect calendar');
    }
  }

  private async getAuthenticatedClient(userId: string) {
    const account = await storage.getOAuthAccount(userId, 'google');
    if (!account) {
      throw new Error('No calendar connection found');
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expiry_date: account.tokenExpiry?.getTime()
    });

    // Check if token needs refresh
    if (account.tokenExpiry && account.tokenExpiry < new Date()) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await storage.createOrUpdateOAuthAccount(userId, {
          ...account,
          accessToken: credentials.access_token!,
          refreshToken: credentials.refresh_token || account.refreshToken,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
        });
        oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error('Error refreshing token:', error);
        throw new Error('Calendar connection expired');
      }
    }

    return oauth2Client;
  }

  async createCalendarEvent(managerId: string, showing: Showing): Promise<{ eventId: string; htmlLink: string }> {
    try {
      const oauth2Client = await this.getAuthenticatedClient(managerId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: `Property Showing - ${showing.clientName}`,
        description: `Property showing for lot ${showing.lotId}\n\nClient: ${showing.clientName}\nEmail: ${showing.clientEmail}\nPhone: ${showing.clientPhone}`,
        start: {
          dateTime: showing.startDt.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: showing.endDt.toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          { email: showing.clientEmail, displayName: showing.clientName }
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all'
      });

      return {
        eventId: response.data.id!,
        htmlLink: response.data.htmlLink!
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async updateCalendarEvent(managerId: string, showing: Showing): Promise<{ eventId: string; htmlLink: string }> {
    if (!showing.calendarEventId) {
      return this.createCalendarEvent(managerId, showing);
    }

    try {
      const oauth2Client = await this.getAuthenticatedClient(managerId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: `Property Showing - ${showing.clientName}`,
        description: `Property showing for lot ${showing.lotId}\n\nClient: ${showing.clientName}\nEmail: ${showing.clientEmail}\nPhone: ${showing.clientPhone}`,
        start: {
          dateTime: showing.startDt.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: showing.endDt.toISOString(),
          timeZone: 'UTC',
        },
        status: showing.status === 'CANCELED' ? 'cancelled' : 'confirmed'
      };

      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: showing.calendarEventId,
        requestBody: event,
        sendUpdates: 'all'
      });

      return {
        eventId: response.data.id!,
        htmlLink: response.data.htmlLink!
      };
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  async deleteCalendarEvent(managerId: string, eventId: string): Promise<void> {
    try {
      const oauth2Client = await this.getAuthenticatedClient(managerId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }
}

export const calendarService = new CalendarService();
