# Google Drive Integration - OAuth Setup

This feature automatically uploads lot photos to the MHP_LORD's Google Drive when anyone uploads photos to lots.

## How It Works

- **Only the MHP_LORD user** can connect their Google Drive
- When **any user** uploads photos to a lot, they are automatically synced to the MHP_LORD's Google Drive
- Photos are organized in folders named: `{Park Name} - {Lot Name}`
- Example: "Sunset Park - Lot 123"
- All folders are created in the MHP_LORD's Google Drive (centralized storage)

## Setup Steps

### 1. MHP_LORD Connects Google Drive

1. **Log in as MHP_LORD** (the owner/main administrator)
2. **Go to either**:
   - **Admin Lots page** (`/admin/lots`), OR
   - **Manager Lots page** (`/manager/lots`)
3. **Find the "Google Drive Backup" card** at the top of the page
4. **Click "Connect Drive"** button
5. **Authorize** the application in the popup window
6. That's it! All lot photos will now automatically upload to your Drive

### 2. All Users Can Upload

- **Managers, Admins, and other users** can upload photos to lots as normal
- They don't need to connect anything
- All their uploads automatically go to the MHP_LORD's Drive

### 2. Test the Integration

1. **Upload photos** to any lot
2. **Check your Google Drive** - you should see a new folder with the format `Park Name - Lot Name`
3. **Verify photos** are inside that folder

## Technical Details

### OAuth Scopes

The app uses the `drive.file` scope, which means:
- ✅ It can only see and modify files it creates
- ✅ It cannot see your existing Drive files
- ✅ It's the most restrictive and secure scope

### Folder Structure

```
Your Google Drive
├── Sunset Park - Lot 1
│   ├── photo1.jpg
│   ├── photo2.jpg
├── Sunset Park - Lot 2
│   ├── photo1.jpg
├── Oak View Park - Lot 15
│   ├── photo1.jpg
│   ├── photo2.jpg
│   └── photo3.jpg
```

### Requirements

- Google account (Gmail or Google Workspace)
- OAuth credentials already configured (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`)
- The same OAuth credentials used for Google Calendar and Sheets work for Drive too
- **Optional:** `GOOGLE_DRIVE_PARENT_FOLDER_ID` - ID of a parent folder where all lot folders will be created

## Disconnecting Google Drive

If you want to stop syncing to Drive:

1. Go to your profile/settings
2. Click "Disconnect Google Drive"
3. Photos will no longer sync (but existing photos in Drive will remain)

## FAQ

### Q: Who can connect their Google Drive?

**A:** Only the MHP_LORD user can connect their Google Drive. This ensures all photos are stored in one centralized location.

### Q: What if I'm not logged in as MHP_LORD?

**A:** You can still upload photos normally. They will automatically sync to the MHP_LORD's Drive (if they've connected it).

### Q: Can multiple users connect their own Drives?

**A:** No. Only MHP_LORD can connect. This ensures all lot photos go to one central Drive for the organization.

### Q: What if I disconnect and reconnect?

**A:** Old photos remain in your Drive. New photos will create new folders if needed.

### Q: What if the Drive connection fails?

**A:** Photos still upload to S3/local storage. Drive sync is a bonus feature - if it fails, the main upload still works.

### Q: Can I change which Google account is connected?

**A:** Yes, but only MHP_LORD can disconnect and reconnect. The new account will receive all future uploads.

### Q: Do old photos sync when I connect?

**A:** No. Only new photos uploaded after connecting will sync to Drive. Existing photos remain in S3/local storage only.

### Q: What if there's no MHP_LORD user?

**A:** The Drive integration won't work. At least one MHP_LORD user must exist and connect their Drive.

## Troubleshooting

### "Connect Google Drive" button doesn't appear

- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your `.env`
- Restart your server
- These are the same credentials used for Calendar and Sheets

### Photos not syncing to Drive

- Check if Google Drive is connected: look for the connection status in your profile
- Check server logs for Drive upload errors
- Try disconnecting and reconnecting
- Verify you gave the app permission to access your Drive

### "OAuth not configured" error

- Add these to your `.env` file:
  ```
  GOOGLE_CLIENT_ID=your-client-id
  GOOGLE_CLIENT_SECRET=your-client-secret
  ```
- These are the same credentials you're already using for Calendar/Sheets
- Restart the server

### How to organize folders in a specific parent folder

By default, lot folders (e.g., "Sunset Park - Lot 123") are created in the root of your Google Drive. To organize them all inside a specific parent folder:

1. **Create a folder in your Google Drive** (e.g., "MHP Lots" or "Property Photos")
2. **Get the folder ID**:
   - Open the folder in Google Drive
   - Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part
3. **Add to your `.env` file**:
   ```
   GOOGLE_DRIVE_PARENT_FOLDER_ID=your-folder-id-here
   ```
4. **Restart the server**

Now all lot folders will be created inside your specified parent folder instead of the root!

**Example folder structure:**
```
Your Google Drive
└── MHP Lots (your parent folder)
    ├── Sunset Park - Lot 1
    │   ├── photo1.jpg
    │   └── photo2.jpg
    ├── Sunset Park - Lot 2
    │   └── photo1.jpg
    └── Oak View Park - Lot 15
        ├── photo1.jpg
        └── photo2.jpg
```

## Benefits of This Approach

✅ **Centralized Storage** - All photos in one Drive account (MHP_LORD's)
✅ **No setup for other users** - Managers and admins just upload, no Drive connection needed
✅ **No configuration files** - No JSON files, no service accounts, no folder IDs
✅ **Works with any Google account** - Gmail or Workspace
✅ **Secure** - Only accesses files it creates
✅ **Simple** - MHP_LORD clicks "Connect" once, everyone benefits

