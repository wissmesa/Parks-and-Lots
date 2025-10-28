#!/usr/bin/env node

/**
 * Generate a secure encryption key for message encryption
 * 
 * This script generates a 32-byte (256-bit) random key suitable for AES-256-GCM encryption.
 * Add the generated key to your .env file as ENCRYPTION_KEY
 * 
 * Usage: node generate-encryption-key.js
 */

const crypto = require('crypto');

console.log('\n=== Encryption Key Generator ===\n');
console.log('Generating a secure 32-byte (256-bit) encryption key for AES-256-GCM...\n');

const key = crypto.randomBytes(32).toString('hex');

console.log('✅ Generated encryption key:');
console.log('\n' + key + '\n');
console.log('Add this to your .env file as:');
console.log(`ENCRYPTION_KEY=${key}\n`);
console.log('⚠️  WARNING: Keep this key secret! Do not commit it to version control.');
console.log('⚠️  If you lose this key, you will NOT be able to decrypt existing messages.\n');

