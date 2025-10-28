#!/usr/bin/env node

/**
 * Migration Script: Encrypt Existing Unencrypted Messages
 * 
 * This script checks all existing messages in the database and encrypts any
 * that are currently stored as plaintext.
 * 
 * Usage:
 *   DRY RUN (recommended first): node migrate-encrypt-messages.cjs --dry-run
 *   LIVE RUN: node migrate-encrypt-messages.cjs
 * 
 * IMPORTANT: 
 * - Make a database backup before running this in production
 * - This is a one-time migration
 * - Once messages are encrypted, you cannot revert without the encryption key
 */

require('dotenv/config');
const { Pool } = require('pg');
const crypto = require('crypto');

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const DRY_RUN = process.argv.includes('--dry-run');

console.log('\n=== Message Encryption Migration ===\n');

if (DRY_RUN) {
  console.log('🔍 Running in DRY RUN mode - no changes will be made');
} else {
  console.log('⚠️  Running in LIVE mode - database will be modified');
  console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');
  
  // Give user time to cancel
  const countdown = (seconds) => {
    if (seconds === 0) {
      console.log('Starting migration...\n');
      return;
    }
    console.log(`Starting in ${seconds}...`);
    setTimeout(() => countdown(seconds - 1), 1000);
  };
  
  // Wait 5 seconds before starting (but only in live mode)
  if (!DRY_RUN) {
    setTimeout(() => {
      countdown(5);
      setTimeout(() => runMigration(), 6000);
    }, 0);
    return;
  }
}

// Get encryption key
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.error('❌ ERROR: ENCRYPTION_KEY environment variable is not set!');
    console.error('   Generate one with: node generate-encryption-key.js');
    process.exit(1);
  }
  
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }
    return keyBuffer;
  } catch (error) {
    console.error('❌ ERROR: Invalid ENCRYPTION_KEY format. Must be a 64-character hex string.');
    process.exit(1);
  }
}

// Encrypt a message
function encryptMessage(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  const result = Buffer.concat([iv, authTag, encrypted]);
  
  return result.toString('base64');
}

// Check if a string is already encrypted (base64 encoded with correct structure)
function isEncrypted(content) {
  try {
    // Try to decode from base64
    const buffer = Buffer.from(content, 'base64');
    
    // Check if it has the minimum length (IV + Auth Tag + at least 1 byte of data)
    if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return false;
    }
    
    // If it successfully decoded and has the right length, assume it's encrypted
    // (We can't be 100% sure without trying to decrypt, but that's expensive)
    return true;
  } catch (error) {
    // If it can't be decoded from base64, it's likely plaintext
    return false;
  }
}

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('📊 Fetching messages from database...\n');
    
    const result = await pool.query('SELECT id, content FROM crm_messages ORDER BY created_at');
    const messages = result.rows;
    
    console.log(`Found ${messages.length} total messages\n`);
    
    if (messages.length === 0) {
      console.log('✅ No messages to migrate');
      await pool.end();
      return;
    }
    
    // Check which messages need encryption
    const unencryptedMessages = messages.filter(msg => !isEncrypted(msg.content));
    const alreadyEncrypted = messages.length - unencryptedMessages.length;
    
    console.log(`✅ Already encrypted: ${alreadyEncrypted} messages`);
    console.log(`🔓 Need encryption: ${unencryptedMessages.length} messages\n`);
    
    if (unencryptedMessages.length === 0) {
      console.log('✅ All messages are already encrypted - nothing to do!');
      await pool.end();
      return;
    }
    
    if (DRY_RUN) {
      console.log('📋 DRY RUN RESULTS:');
      console.log(`Would encrypt ${unencryptedMessages.length} messages:`);
      unencryptedMessages.slice(0, 5).forEach(msg => {
        const preview = msg.content.substring(0, 50);
        console.log(`  - ID: ${msg.id} | Preview: "${preview}${msg.content.length > 50 ? '...' : ''}"`);
      });
      if (unencryptedMessages.length > 5) {
        console.log(`  ... and ${unencryptedMessages.length - 5} more`);
      }
      console.log('\nRun without --dry-run to actually encrypt these messages');
    } else {
      console.log('🔐 Encrypting messages...\n');
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const msg of unencryptedMessages) {
        try {
          const encrypted = encryptMessage(msg.content);
          await pool.query(
            'UPDATE crm_messages SET content = $1 WHERE id = $2',
            [encrypted, msg.id]
          );
          successCount++;
          
          if (successCount % 10 === 0) {
            console.log(`Progress: ${successCount}/${unencryptedMessages.length} messages encrypted`);
          }
        } catch (error) {
          console.error(`❌ Error encrypting message ${msg.id}:`, error.message);
          errorCount++;
        }
      }
      
      console.log('\n=== Migration Complete ===');
      console.log(`✅ Successfully encrypted: ${successCount} messages`);
      if (errorCount > 0) {
        console.log(`❌ Errors: ${errorCount} messages`);
      }
      console.log(`📊 Total processed: ${successCount + errorCount}/${unencryptedMessages.length}`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run immediately if dry run, otherwise the countdown will handle it
if (DRY_RUN) {
  runMigration();
}

