import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const SALT_LENGTH = 32; // 32 bytes for key derivation

/**
 * Get or generate encryption key from environment
 * The key should be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.error('⚠️  WARNING: ENCRYPTION_KEY environment variable is not set!');
    console.error('Generate one with: npm run generate-key');
    console.error('Then add it to your .env file and restart the server.');
    
    // In development, use a temporary key with a big warning
    if (process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'DEVELOPMENT') {
      console.error('');
      console.error('🔓 INSECURE MODE: Using temporary encryption key for development');
      console.error('⚠️  DO NOT USE IN PRODUCTION! Messages are not securely encrypted!');
      console.error('');
      
      // Generate a temporary key for this session (not persistent)
      const tempKey = crypto.randomBytes(32);
      console.warn('⚠️  This temporary key will be lost on restart - messages may be undecryptable!');
      return tempKey;
    }
    
    throw new Error('ENCRYPTION_KEY is required for message encryption');
  }
  
  // Convert hex string to buffer
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
    return keyBuffer;
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format. Must be a 64-character hex string.');
  }
}

/**
 * Encrypt a message using AES-256-GCM
 * Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 * Returns base64 encoded string
 */
export function encryptMessage(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    
    // Generate random IV for each message
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the message
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV + Auth Tag + Encrypted Data
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    // Return as base64
    return result.toString('base64');
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt a message using AES-256-GCM
 * Expects base64 encoded string in format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 */
export function decryptMessage(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    
    // Decode from base64
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the message
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Error decrypting message:', error);
    // Return a placeholder for corrupted/undecryptable messages
    return '[Message could not be decrypted]';
  }
}

/**
 * Test encryption/decryption
 */
export function testEncryption(): boolean {
  try {
    const testMessage = 'Hello, this is a test message! 🔒';
    const encrypted = encryptMessage(testMessage);
    const decrypted = decryptMessage(encrypted);
    
    const success = testMessage === decrypted;
    if (success) {
      console.log('✅ Encryption test passed');
    } else {
      console.error('❌ Encryption test failed: decrypted message does not match original');
    }
    return success;
  } catch (error) {
    console.error('❌ Encryption test failed with error:', error);
    return false;
  }
}

