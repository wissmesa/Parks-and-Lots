const { db } = require('./server/db.ts');
const { tenants } = require('./shared/schema.ts');
const { sql } = require('drizzle-orm');

async function fixDuplicateEmails() {
  try {
    console.log('Checking for duplicate tenant emails...');
    
    // Find duplicate emails
    const duplicates = await db.execute(sql`
      SELECT email, COUNT(*) as count
      FROM tenants 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);
    
    console.log('Found duplicate emails:', duplicates.rows);
    
    if (duplicates.rows.length > 0) {
      console.log('Duplicate emails found. Please manually resolve these before applying the unique constraint.');
      console.log('You can either:');
      console.log('1. Delete the duplicate tenant records');
      console.log('2. Update the email addresses to be unique');
      console.log('3. Merge the tenant records if they represent the same person');
      
      for (const duplicate of duplicates.rows) {
        console.log(`\nEmail: ${duplicate.email} (${duplicate.count} records)`);
        
        // Get all tenants with this email
        const tenantsWithEmail = await db.execute(sql`
          SELECT id, "firstName", "lastName", email, "lotId", status, "createdAt"
          FROM tenants 
          WHERE email = ${duplicate.email}
          ORDER BY "createdAt" ASC
        `);
        
        console.log('Tenants with this email:');
        tenantsWithEmail.rows.forEach((tenant, index) => {
          console.log(`  ${index + 1}. ID: ${tenant.id}, Name: ${tenant.firstName} ${tenant.lastName}, Lot: ${tenant.lotId}, Status: ${tenant.status}, Created: ${tenant.createdAt}`);
        });
      }
    } else {
      console.log('No duplicate emails found. Safe to apply unique constraint.');
    }
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
  }
}

fixDuplicateEmails();
