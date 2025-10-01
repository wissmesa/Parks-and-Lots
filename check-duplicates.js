import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function checkDuplicates() {
  try {
    console.log('Checking for duplicate tenant emails...');
    
    const duplicates = await db.execute(sql`
      SELECT email, COUNT(*) as count
      FROM tenants 
      GROUP BY email 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    console.log('Duplicate emails found:', duplicates.rows);
    
    if (duplicates.rows.length > 0) {
      for (const duplicate of duplicates.rows) {
        const tenants = await db.execute(sql`
          SELECT id, "firstName", "lastName", email, "lotId", status, "createdAt"
          FROM tenants 
          WHERE email = ${duplicate.email}
          ORDER BY "createdAt" ASC
        `);
        
        console.log(`\nEmail: ${duplicate.email} (${duplicate.count} records)`);
        tenants.rows.forEach((tenant, index) => {
          console.log(`  ${index + 1}. ${tenant.firstName} ${tenant.lastName} - Lot: ${tenant.lotId} - ${tenant.status} - ${tenant.createdAt}`);
        });
      }
    } else {
      console.log('No duplicate emails found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDuplicates();
