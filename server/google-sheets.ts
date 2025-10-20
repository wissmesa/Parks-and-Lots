import { google } from 'googleapis';
import { storage } from './storage';
import type { Lot } from '@shared/schema';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}/api/auth/google-sheets/callback`
  : 'http://localhost:5000/api/auth/google-sheets/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets', // Full access to spreadsheets (read/write any sheet)
  'https://www.googleapis.com/auth/drive.file' // Access to files created by this app
];

// Facebook webhook URL - should match the one in facebook-config.ts
const FACEBOOK_WEBHOOK_URL = process.env.FACEBOOK_WEBHOOK_URL || 'https://hook.us2.make.com/6layguqfpk3i6imvyg7i96wc2fffewn2';

// Helper function to get Facebook config by park name
function getFacebookIdByParkName(parkName: string): string | null {
  // This matches the config in client/src/lib/facebook-config.ts
  const parkConfigs: { [key: string]: string } = {
    'Richmond Mobile Home Park': '321325917734508',
    'Aberdeen Mobile Home Park': '240633272475459',
    'Amelia Mobile Home Park': '114923781526224',
    'Aurora Mobile Home Park': '620221604502913',
    'CreekSide Mobile Home Park': '319339847930489',
    'Deluxe Mobile Home Park': '353098991211829',
    'Eastlane Mobile Home Park': '103477896023777',
    'Ontario Mobile Home Park': '694757763724654',
    'High Meadows Mobile Home Park': '427458087107212',
    'Three Rivers Mobile Home Park': '692084087327854',
    'Rustic Mobile Home Park': '738689052659408',
    'Homestead Mobile Home Park': '100815996313376'
  };
  return parkConfigs[parkName] || null;
}

// Helper function to fetch Facebook posts and find matching post ID
async function findFacebookPostIdForLot(parkName: string, lotName: string): Promise<string | null> {
  try {
    const facebookId = getFacebookIdByParkName(parkName);
    
    if (!facebookId) {
      console.log(`[Facebook] No Facebook ID found for park: ${parkName}`);
      return null;
    }
    
    const requestData = {
      parkName: parkName,
      facebookId: facebookId,
      timestamp: new Date().toISOString()
    };

    console.log(`[Facebook] Fetching posts for park: ${parkName}, lot: ${lotName}`);
    console.log(`[Facebook] Using Facebook ID: ${facebookId}`);
    console.log(`[Facebook] Webhook URL: ${FACEBOOK_WEBHOOK_URL}`);
    
    const response = await fetch(FACEBOOK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      console.error(`[Facebook] Webhook request failed: ${response.status}`);
      return null;
    }

    const responseData = await response.json() as any;
    
    // The webhook returns an array of posts
    if (Array.isArray(responseData)) {
      console.log(`[Facebook] Received ${responseData.length} posts`);
      
      // Search from first to last for a post that mentions the lot name
      for (const post of responseData) {
        const message = post.message || '';
        const description = post.description || '';
        const story = post.story || '';
        
        // Check if any text field mentions the lot name (case-insensitive)
        const searchText = `${message} ${description} ${story}`.toLowerCase();
        const lotSearchTerm = lotName.toLowerCase();
        
        if (searchText.includes(lotSearchTerm)) {
          console.log(`[Facebook] Found matching post: ${post.id} (searched in: message, description, story)`);
          console.log(`[Facebook] Post content preview: ${searchText.substring(0, 200)}...`);
          return post.id;
        }
      }
      
      console.log(`[Facebook] No post found mentioning lot: ${lotName}`);
    }
    
    return null;
  } catch (error) {
    console.error('[Facebook] Error fetching posts:', error);
    return null;
  }
}

export class GoogleSheetsService {
  private oauth2Client: any;

  constructor() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      this.oauth2Client = null;
      return;
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
  }

  generateAuthUrl(state: string): string {
    if (!this.oauth2Client) {
      throw new Error('Google Sheets not configured');
    }
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent screen to always get a refresh token
      scope: SCOPES,
      state: state
    });
  }

  async exchangeCodeForTokens(code: string) {
    if (!this.oauth2Client) {
      throw new Error('Google Sheets not configured');
    }
    
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  async storeTokens(userId: string, tokens: any) {
    // Get existing account to preserve refresh token and spreadsheet ID if not provided
    const existingAccount = await storage.getOAuthAccount(userId, 'google-sheets');
    
    await storage.createOrUpdateOAuthAccount(userId, {
      provider: 'google-sheets',
      accessToken: tokens.access_token,
      // Preserve existing refresh token if new one isn't provided (Google only sends it on first auth)
      refreshToken: tokens.refresh_token || existingAccount?.refreshToken,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope,
      // Preserve existing spreadsheet ID
      spreadsheetId: existingAccount?.spreadsheetId
    });
  }

  async setSpreadsheetId(userId: string, spreadsheetId: string) {
    const account = await storage.getOAuthAccount(userId, 'google-sheets');
    if (!account) {
      throw new Error('Google Sheets not connected');
    }
    
    await storage.createOrUpdateOAuthAccount(userId, {
      ...account,
      spreadsheetId
    });
  }

  async getSpreadsheetId(userId: string): Promise<string | null> {
    const account = await storage.getOAuthAccount(userId, 'google-sheets');
    return account?.spreadsheetId || null;
  }

  async getValidAccessToken(userId: string, retryCount = 0): Promise<string | null> {
    try {
      const account = await storage.getOAuthAccount(userId, 'google-sheets');
      
      if (!account) {
        return null;
      }

      if (!this.oauth2Client) {
        throw new Error('Google Sheets not configured');
      }

      this.oauth2Client.setCredentials({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
        expiry_date: account.tokenExpiry?.getTime()
      });

      // Check if token needs refresh
      if (account.tokenExpiry && account.tokenExpiry < new Date()) {
        try {
          const { credentials } = await this.oauth2Client.refreshAccessToken();
          
          await storage.createOrUpdateOAuthAccount(userId, {
            ...account,
            accessToken: credentials.access_token!,
            refreshToken: credentials.refresh_token || account.refreshToken,
            tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
          });
          
          return credentials.access_token!;
        } catch (refreshError) {
          console.error('Error refreshing Google Sheets token:', refreshError);
          return null;
        }
      }
      
      return account.accessToken;
    } catch (error) {
      console.error('Error getting Google Sheets access token:', error);
      return null;
    }
  }

  async createSheetsClient(userId: string) {
    const accessToken = await this.getValidAccessToken(userId);
    
    if (!accessToken) {
      throw new Error('No valid Google Sheets access token found');
    }

    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    return google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  async exportLotToSheet(userId: string, lot: any): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      const sheets = await this.createSheetsClient(userId);
      const spreadsheetId = await this.getSpreadsheetId(userId);
      
      if (!spreadsheetId) {
        throw new Error('No spreadsheet linked. Please provide a Google Sheet ID first.');
      }

      // Get the first sheet's name dynamically
      let sheetName = 'Sheet1';
      try {
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId,
        });
        if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
          sheetName = spreadsheet.data.sheets[0].properties?.title || 'Sheet1';
        }
      } catch (error) {
        console.log('Error getting sheet name, using default Sheet1:', error);
      }

      // Use stored Facebook post ID from lot, or fallback to searching
      console.log(`[Export] Processing Facebook post ID for lot: ${lot.nameOrNumber}, park: ${lot.park?.name}`);
      let facebookPostId = lot.facebookPostId || '';
      
      // If no stored ID, try to find it (backward compatibility)
      if (!facebookPostId && lot.park?.name && lot.nameOrNumber) {
        console.log(`[Export] No stored Facebook post ID, searching...`);
        const postId = await findFacebookPostIdForLot(lot.park.name, lot.nameOrNumber);
        facebookPostId = postId || '';
        if (postId) {
          console.log(`[Export] Found Facebook post ID via search: ${postId}`);
        }
      } else if (facebookPostId) {
        console.log(`[Export] Using stored Facebook post ID: ${facebookPostId}`);
      }

      // Check if headers exist in the sheet
      let hasHeaders = false;
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:P1`,
        });
        hasHeaders = !!(response.data.values && response.data.values.length > 0);
      } catch (error) {
        console.log('Error checking headers, will add them:', error);
      }

      const headers = [
        'Facebook Post ID',
        'Park Name',
        'Address',
        'Lot Number',
        'Lot Rent',
        'Sale Price',
        'Promotional Price',
        'Rent Price',
        'Estimated Payment',
        'Available Date',
        'Status',
        'Mobile Home Year',
        'Mobile Home Size',
        'Mobile Home SqFt',
        'Bedrooms',
        'Bathrooms'
      ];

      // Format status array to string
      let statusStr = '';
      if (Array.isArray(lot.status)) {
        statusStr = lot.status.join(', ');
      } else if (lot.status) {
        statusStr = lot.status;
      }

      // Format available date
      let availableDateStr = '';
      if (lot.availableDate) {
        const date = new Date(lot.availableDate);
        availableDateStr = date.toLocaleDateString();
      }

      const lotRow = [
        facebookPostId,
        lot.park?.name || '',
        lot.park?.address || '',
        lot.nameOrNumber || '',
        lot.lotRent || '',
        lot.priceForSale || '',
        lot.promotionalPrice || '',
        lot.priceForRent || '',
        lot.estimatedPayment || '',
        availableDateStr,
        statusStr,
        lot.mobileHomeYear?.toString() || '',
        lot.mobileHomeSize || '',
        lot.sqFt?.toString() || '',
        lot.bedrooms?.toString() || '',
        lot.bathrooms?.toString() || ''
      ];

      // If no headers, add them first
      if (!hasHeaders) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:P1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });
      }

      // Append the lot data
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:P`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [lotRow]
        }
      });

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      return {
        spreadsheetId,
        spreadsheetUrl
      };
    } catch (error) {
      console.error('Error exporting lot to Google Sheets:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to export lot to Google Sheets: ${error.message}`);
      }
      throw new Error('Failed to export lot to Google Sheets');
    }
  }

  async exportMultipleLotsToSheet(userId: string, lots: any[]): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    try {
      const sheets = await this.createSheetsClient(userId);
      const spreadsheetId = await this.getSpreadsheetId(userId);
      
      if (!spreadsheetId) {
        throw new Error('No spreadsheet linked. Please provide a Google Sheet ID first.');
      }

      // Get the first sheet's name dynamically
      let sheetName = 'Sheet1';
      try {
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId,
        });
        if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
          sheetName = spreadsheet.data.sheets[0].properties?.title || 'Sheet1';
        }
      } catch (error) {
        console.log('Error getting sheet name, using default Sheet1:', error);
      }

      // Check if headers exist in the sheet
      let hasHeaders = false;
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:P1`,
        });
        hasHeaders = !!(response.data.values && response.data.values.length > 0);
      } catch (error) {
        console.log('Error checking headers, will add them:', error);
      }

      const headers = [
        'Facebook Post ID',
        'Park Name',
        'Address',
        'Lot Number',
        'Lot Rent',
        'Sale Price',
        'Promotional Price',
        'Rent Price',
        'Estimated Payment',
        'Available Date',
        'Status',
        'Mobile Home Year',
        'Mobile Home Size',
        'Mobile Home SqFt',
        'Bedrooms',
        'Bathrooms'
      ];

      // Fetch Facebook post IDs for all lots (with park name grouping for efficiency)
      console.log(`[Export Multiple] Processing ${lots.length} lots`);
      const lotRows = await Promise.all(lots.map(async (lot) => {
        // Format status array to string
        let statusStr = '';
        if (Array.isArray(lot.status)) {
          statusStr = lot.status.join(', ');
        } else if (lot.status) {
          statusStr = lot.status;
        }

        // Fetch Facebook post ID for this lot
        let facebookPostId = '';
        if (lot.park?.name && lot.nameOrNumber) {
          const postId = await findFacebookPostIdForLot(lot.park.name, lot.nameOrNumber);
          facebookPostId = postId || '';
        }

        // Format available date
        let availableDateStr = '';
        if (lot.availableDate) {
          const date = new Date(lot.availableDate);
          availableDateStr = date.toLocaleDateString();
        }

        return [
          facebookPostId,
          lot.park?.name || '',
          lot.park?.address || '',
          lot.nameOrNumber || '',
          lot.lotRent || '',
          lot.priceForSale || '',
          lot.promotionalPrice || '',
          lot.priceForRent || '',
          lot.estimatedPayment || '',
          availableDateStr,
          statusStr,
          lot.mobileHomeYear?.toString() || '',
          lot.mobileHomeSize || '',
          lot.sqFt?.toString() || '',
          lot.bedrooms?.toString() || '',
          lot.bathrooms?.toString() || ''
        ];
      }));

      // If no headers, add them first
      if (!hasHeaders) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:P1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });
      }

      // Append all lot data
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:P`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: lotRows
        }
      });

      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      return {
        spreadsheetId,
        spreadsheetUrl
      };
    } catch (error) {
      console.error('Error exporting lots to Google Sheets:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to export lots to Google Sheets: ${error.message}`);
      }
      throw new Error('Failed to export lots to Google Sheets');
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();