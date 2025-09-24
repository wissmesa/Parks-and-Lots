require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Running manual migration...');
    
    // Step 1: Add new enum values
    console.log('Adding RENT_TO_OWN enum value...');
    await client.query("ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'RENT_TO_OWN'");
    
    console.log('Adding CONTRACT_FOR_DEED enum value...');
    await client.query("ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'CONTRACT_FOR_DEED'");
    
    // Step 2: Update existing RENT_SALE values to RENT_TO_OWN
    console.log('Updating existing RENT_SALE values to RENT_TO_OWN...');
    const updateResult = await client.query("UPDATE lots SET status = 'RENT_TO_OWN' WHERE status = 'RENT_SALE'");
    console.log(`Updated ${updateResult.rowCount} rows`);
    
    // Step 3: Add new columns if they don't exist
    console.log('Adding house_manufacturer column...');
    await client.query("ALTER TABLE lots ADD COLUMN IF NOT EXISTS house_manufacturer varchar");
    
    console.log('Adding house_model column...');
    await client.query("ALTER TABLE lots ADD COLUMN IF NOT EXISTS house_model varchar");
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
