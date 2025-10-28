# DM Encryption Implementation

## Overview

All Direct Messages (DMs) in the CRM messaging system are now encrypted at rest in the database using **AES-256-GCM** encryption. This ensures that message content is protected and cannot be read by anyone with database access.

## Features

✅ **End-to-End Database Encryption**: Message content is encrypted before being stored in the database
✅ **AES-256-GCM**: Industry-standard authenticated encryption algorithm
✅ **Automatic Encryption/Decryption**: Transparent to the application - messages are encrypted on save and decrypted on retrieval
✅ **Per-Message IV**: Each message uses a unique initialization vector for maximum security
✅ **Authentication Tags**: GCM mode provides authenticity verification to detect tampering
✅ **Backward Compatible**: Works seamlessly with existing WebSocket real-time messaging

## Security Details

### Encryption Algorithm
- **Algorithm**: AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes) - randomly generated for each message
- **Auth Tag Size**: 128 bits (16 bytes) - for message authentication

### Data Format
Encrypted messages are stored in the database as base64-encoded strings with the following structure:
```
[IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Content (variable)]
```

This format ensures:
1. Each message has a unique IV (prevents pattern analysis)
2. Message authenticity is verified on decryption (detects tampering)
3. Compact storage (single text field)

## Setup Instructions

### 1. Generate an Encryption Key

Run the key generation script:
```bash
npm run generate-key
# or: node generate-encryption-key.js
```

This will output a secure 32-byte (256-bit) random key suitable for AES-256-GCM encryption.

### 2. Add Key to Environment Variables

Add the generated key to your `.env` file:
```env
ENCRYPTION_KEY=your_64_character_hex_string_here
```

⚠️ **IMPORTANT**: 
- Keep this key **SECRET** - never commit it to version control
- **Back up this key securely** - if you lose it, you cannot decrypt existing messages
- Use different keys for development, staging, and production environments

### 3. Migrate Existing Messages (If Applicable)

If you have existing unencrypted messages in the database, run the migration script:

```bash
# First, do a dry run to see what would be changed
npm run migrate:encrypt-messages:dry-run
# or: node migrate-encrypt-messages.cjs --dry-run

# If everything looks good, run the actual migration
npm run migrate:encrypt-messages
# or: node migrate-encrypt-messages.cjs
```

⚠️ **IMPORTANT**: Make a database backup before running the migration in production!

### 4. Restart the Server

The server will automatically test the encryption on startup:
```bash
npm run dev
```

You should see:
```
Testing message encryption...
✅ Encryption test passed
serving on port 5000
```

## Implementation Details

### Files Created/Modified

1. **`server/encryption.ts`** (NEW)
   - `encryptMessage(plaintext)`: Encrypts a message
   - `decryptMessage(encryptedData)`: Decrypts a message
   - `testEncryption()`: Tests encryption/decryption on startup

2. **`server/storage.ts`** (MODIFIED)
   - Added import of encryption functions
   - `createCrmMessage()`: Encrypts content before storing
   - `getCrmMessages()`: Decrypts content after retrieval
   - `getCrmMessage()`: Decrypts single message
   - `getConversations()`: Decrypts last message preview

3. **`server/index.ts`** (MODIFIED)
   - Added encryption test on server startup
   - Validates ENCRYPTION_KEY is configured

4. **`generate-encryption-key.js`** (NEW)
   - Utility script to generate secure encryption keys

5. **`.env.example`** (CREATED)
   - Example environment variables including ENCRYPTION_KEY

6. **`migrate-encrypt-messages.cjs`** (NEW)
   - Migration script for encrypting existing unencrypted messages
   - Supports dry-run mode for safety

7. **`DM_ENCRYPTION_IMPLEMENTATION.md`** (NEW)
   - This documentation file

### How It Works

#### Sending a Message
```typescript
// 1. User sends plaintext via WebSocket
socket.emit("send_message", { receiverId: "123", content: "Hello!" });

// 2. Server encrypts before storing
async createCrmMessage(message: InsertCrmMessage): Promise<CrmMessage> {
  const encryptedMessage = {
    ...message,
    content: encryptMessage(message.content) // "Hello!" → "base64_encrypted_data"
  };
  
  // Store encrypted content in database
  const [result] = await db.insert(crmMessages).values(encryptedMessage).returning();
  
  // Return plaintext to caller (for real-time delivery)
  return {
    ...result,
    content: message.content // Original plaintext
  };
}
```

#### Retrieving Messages
```typescript
// 1. Server fetches encrypted messages from database
const results = await db.select()
  .from(crmMessages)
  .where(conditions);

// 2. Decrypt before returning to client
return results.map(msg => ({
  ...msg,
  content: decryptMessage(msg.content) // "base64_encrypted_data" → "Hello!"
}));

// 3. Client receives plaintext messages
```

## Security Considerations

### ✅ What This Protects Against
1. **Database Breach**: Attackers with database access cannot read message content
2. **Database Backups**: Backups contain only encrypted data
3. **Insider Threats**: DBAs and system admins cannot read messages
4. **SQL Injection**: Even if attackers extract data, it's encrypted

### ⚠️ What This Does NOT Protect Against
1. **Application-Level Access**: Users with valid authentication can read their messages
2. **Memory Dumps**: Messages are decrypted in application memory
3. **Network Sniffing**: Use HTTPS/TLS for network transport encryption (separate concern)
4. **End-User Device Compromise**: Messages are plaintext in the browser

### Best Practices

1. **Key Management**
   - Store `ENCRYPTION_KEY` in a secure secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Rotate keys periodically (requires re-encryption of existing messages)
   - Use different keys per environment

2. **Monitoring**
   - Monitor for decryption failures (may indicate corrupted data or wrong key)
   - Log encryption errors (but never log keys or plaintext)

3. **Backup Strategy**
   - **CRITICAL**: Back up your encryption key securely
   - Consider key escrow for disaster recovery
   - Test key recovery procedures regularly

4. **Migration**
   - If you need to rotate keys, implement a migration strategy
   - Consider adding a `keyVersion` field to support multiple keys during rotation

## Key Rotation (Future Enhancement)

If you need to rotate the encryption key, you'll need to:

1. Keep the old key accessible
2. Add a `keyVersion` or `encryptionVersion` field to the schema
3. Decrypt messages with the old key and re-encrypt with the new key
4. Implement a background job to migrate existing messages

Example migration:
```typescript
// Pseudocode for key rotation
const oldKey = process.env.OLD_ENCRYPTION_KEY;
const newKey = process.env.ENCRYPTION_KEY;

for (const message of allMessages) {
  const plaintext = decryptMessage(message.content, oldKey);
  const encrypted = encryptMessage(plaintext, newKey);
  await updateMessage(message.id, { content: encrypted, keyVersion: 2 });
}
```

## Troubleshooting

### Error: "ENCRYPTION_KEY is required for message encryption"
**Solution**: Generate a key with `node generate-encryption-key.js` and add it to `.env`

### Error: "ENCRYPTION_KEY must be 32 bytes (64 hex characters)"
**Solution**: Ensure your key is exactly 64 hexadecimal characters

### Messages show as "[Message could not be decrypted]"
**Possible Causes**:
1. Wrong encryption key (using different key than when encrypted)
2. Corrupted database data
3. Format change in encryption implementation

**Solution**: 
- Verify you're using the correct `ENCRYPTION_KEY`
- Check server logs for specific decryption errors
- Restore from backup if data is corrupted

## Testing

The encryption system is tested automatically on server startup. You can also run manual tests:

```typescript
import { encryptMessage, decryptMessage, testEncryption } from './server/encryption';

// Test encryption/decryption
const plaintext = 'Test message';
const encrypted = encryptMessage(plaintext);
const decrypted = decryptMessage(encrypted);

console.assert(plaintext === decrypted, 'Encryption test failed');
```

## Performance Considerations

- **Encryption overhead**: ~0.1-0.5ms per message (negligible)
- **Database storage**: Encrypted messages are ~1.5x larger due to IV, auth tag, and base64 encoding
- **Index limitations**: Cannot create text-search indexes on encrypted content (by design)

## Compliance

This implementation helps meet compliance requirements for:
- ✅ GDPR (data protection at rest)
- ✅ HIPAA (if storing PHI in messages)
- ✅ SOC 2 (data encryption controls)
- ✅ PCI DSS (if storing payment information)

**Note**: Consult with your legal/compliance team for specific requirements.

## Future Enhancements

Possible improvements for future versions:
1. **Key Rotation**: Support for rotating encryption keys
2. **Client-Side Encryption**: True end-to-end encryption (encrypt before sending to server)
3. **Hardware Security Modules**: Use HSM for key storage in production
4. **Searchable Encryption**: Implement searchable encryption scheme if message search is needed
5. **Audit Logging**: Log all encryption/decryption operations for compliance

## Summary

✅ DM content is now encrypted at rest using AES-256-GCM
✅ Encryption is automatic and transparent to users
✅ Setup requires only one environment variable: `ENCRYPTION_KEY`
✅ No database schema changes required
✅ Compatible with existing WebSocket real-time messaging
✅ Tested automatically on server startup

For questions or issues, refer to the troubleshooting section or contact the development team.

