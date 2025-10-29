import { google } from 'googleapis';
import { Readable } from 'stream';
import { storage } from './storage';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_DRIVE_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
const REDIRECT_URI = process.env.REPLIT_DOMAINS 
  ? `https://${process.env.REPLIT_DOMAINS}/api/auth/google-drive/callback`
  : 'http://localhost:5000/api/auth/google-drive/callback';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Check if Google Drive OAuth is configured
const isDriveConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

// Folder cache to avoid repeated API calls
const folderCache = new Map<string, string>();

// Pending folder creation promises to avoid race conditions
const pendingFolderCreations = new Map<string, Promise<string | null>>();

if (!isDriveConfigured) {
  console.warn('⚠️  Google Drive OAuth not configured. Drive uploads will be disabled.');
} else if (GOOGLE_DRIVE_PARENT_FOLDER_ID) {
  console.log(`📁 Google Drive parent folder configured: ${GOOGLE_DRIVE_PARENT_FOLDER_ID}`);
  console.log(`   All lot folders will be created inside this parent folder.`);
}

/**
 * Get Drive client for a specific user using their OAuth tokens
 */
async function getDriveClientForUser(userId: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  const oauthAccount = await storage.getOAuthAccount(userId, 'google-drive');
  if (!oauthAccount || !oauthAccount.accessToken) {
    console.warn(`⚠️  No Google Drive OAuth token found for user ${userId}`);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: oauthAccount.accessToken,
    refresh_token: oauthAccount.refreshToken,
    expiry_date: oauthAccount.tokenExpiry?.getTime(),
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await storage.createOrUpdateOAuthAccount(userId, {
        provider: 'google-drive',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      });
    } else if (tokens.access_token) {
      await storage.createOrUpdateOAuthAccount(userId, {
        provider: 'google-drive',
        accessToken: tokens.access_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      });
    }
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Generate OAuth URL for Drive authorization
 */
export function generateDriveAuthUrl(state: string): string {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Drive OAuth not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeDriveCodeForTokens(code: string) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Drive OAuth not configured');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Find or create a folder in Google Drive
 * @param driveClient - Authenticated Drive client
 * @param folderName - Name of the folder (e.g., "Sunset Park - Lot 123")
 * @param parentFolderId - Optional parent folder ID
 * @returns Folder ID or null if failed
 */
export async function findOrCreateFolder(
  driveClient: any,
  folderName: string,
  parentFolderId?: string
): Promise<string | null> {
  if (!driveClient) {
    return null;
  }

  // Check cache first
  const cacheKey = `${folderName}:${parentFolderId || 'root'}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)!;
  }

  // Check if there's already a pending creation for this folder
  if (pendingFolderCreations.has(cacheKey)) {
    console.log(`⏳ Waiting for pending folder creation: ${folderName}`);
    return pendingFolderCreations.get(cacheKey)!;
  }

  // Create a promise for this folder creation
  const creationPromise = (async () => {
    try {
      // Sanitize folder name to avoid issues with special characters
      const sanitizedFolderName = folderName.replace(/[<>:"/\\|?*]/g, '-');

      // Search for existing folder
      const query = parentFolderId
        ? `name='${sanitizedFolderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${sanitizedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const searchResponse = await driveClient.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      // If folder exists, use it
      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        const folderId = searchResponse.data.files[0].id!;
        console.log(`📁 Found existing folder: ${sanitizedFolderName} (${folderId})`);
        folderCache.set(cacheKey, folderId);
        return folderId;
      }

      // Create new folder if it doesn't exist
      const fileMetadata: any = {
        name: sanitizedFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      if (parentFolderId) {
        fileMetadata.parents = [parentFolderId];
      }

      const createResponse = await driveClient.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });

      const folderId = createResponse.data.id!;
      console.log(`✅ Created new folder: ${sanitizedFolderName} (${folderId})`);
      folderCache.set(cacheKey, folderId);
      return folderId;
    } catch (error) {
      console.error(`❌ Failed to find or create folder "${folderName}":`, error);
      return null;
    } finally {
      // Remove from pending map once completed
      pendingFolderCreations.delete(cacheKey);
    }
  })();

  // Store the promise so other concurrent requests can wait for it
  pendingFolderCreations.set(cacheKey, creationPromise);

  return creationPromise;
}

/**
 * Upload a file to Google Drive
 * @param driveClient - Authenticated Drive client
 * @param file - File buffer
 * @param fileName - Name for the file in Drive
 * @param mimeType - MIME type of the file
 * @param folderId - ID of the folder to upload to
 * @returns File ID or null if failed
 */
export async function uploadFileToDrive(
  driveClient: any,
  file: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string
): Promise<string | null> {
  if (!driveClient) {
    return null;
  }

  try {
    // Sanitize file name
    const sanitizedFileName = fileName.replace(/[<>:"/\\|?*]/g, '-');

    const fileMetadata = {
      name: sanitizedFileName,
      parents: [folderId],
    };

    const media = {
      mimeType: mimeType,
      body: Readable.from(file),
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    console.log(`✅ Uploaded to Drive: ${sanitizedFileName} (${response.data.id})`);
    return response.data.id!;
  } catch (error) {
    console.error(`❌ Failed to upload file "${fileName}" to Drive:`, error);
    return null;
  }
}

/**
 * Delete a file from Google Drive
 * @param fileId - ID of the file to delete
 */
export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
  if (!driveClient) {
    return false;
  }

  try {
    await driveClient.files.delete({
      fileId: fileId,
    });
    console.log(`✅ Deleted file from Drive: ${fileId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete file from Drive (${fileId}):`, error);
    return false;
  }
}

/**
 * Upload lot photo to Google Drive in background
 * This is a fire-and-forget operation that won't block the main upload flow
 * @param userId - User ID who has Google Drive connected
 * @param photoBuffer - Photo file buffer
 * @param fileName - File name
 * @param mimeType - MIME type
 * @param parkName - Park name (optional)
 * @param lotName - Lot name
 */
export function uploadLotPhotoToDrive(
  userId: string,
  photoBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parkName: string | null,
  lotName: string
): void {
  if (!isDriveConfigured) {
    return;
  }

  // Run upload in background (don't await)
  (async () => {
    try {
      // Get Drive client for the user
      const driveClient = await getDriveClientForUser(userId);
      if (!driveClient) {
        console.warn(`⚠️  Google Drive not connected for user ${userId}. Skipping Drive upload.`);
        return;
      }

      // Create folder name: "ParkName - LotName" or just "LotName" if no park
      const folderName = parkName ? `${parkName} - ${lotName}` : lotName;

      // Find or create the folder (optionally inside parent folder if specified in env)
      const folderId = await findOrCreateFolder(
        driveClient, 
        folderName, 
        GOOGLE_DRIVE_PARENT_FOLDER_ID || undefined
      );
      if (!folderId) {
        console.error(`❌ Could not find/create Drive folder for: ${folderName}`);
        return;
      }

      // Upload the file
      await uploadFileToDrive(driveClient, photoBuffer, fileName, mimeType, folderId);
    } catch (error) {
      console.error('❌ Background Drive upload failed:', error);
    }
  })();
}

export { isDriveConfigured };


