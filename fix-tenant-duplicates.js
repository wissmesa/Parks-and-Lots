// Script to fix duplicate tenant emails
// This will update duplicate emails to be unique by adding a suffix

const { db } = require('./server/db.ts');
const { tenants } = require('./shared/schema.ts');
const { sql, eq } = require('drizzle-orm');

async function fixDuplicateTenantEmails() {
  try {
    console.log('🔍 Checking for duplicate tenant emails...');
    
    // Find duplicate emails
    const duplicates = await db.execute(sql`
      SELECT email, COUNT(*) as count
      FROM tenants 
      GROUP BY email 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicate emails found. Database is clean!');
      return;
    }
    
    console.log(`❌ Found ${duplicates.rows.length} duplicate email(s):`);
    
    for (const duplicate of duplicates.rows) {
      const email = duplicate.email;
      const count = duplicate.count;
      
      console.log(`\n📧 Email: ${email} (${count} records)`);
      
      // Get all tenants with this email, ordered by creation date
      const tenantsWithEmail = await db.execute(sql`
        SELECT id, "firstName", "lastName", email, "lotId", status, "createdAt"
        FROM tenants 
        WHERE email = ${email}
        ORDER BY "createdAt" ASC
      `);
      
      console.log('   Tenants with this email:');
      tenantsWithEmail.rows.forEach((tenant, index) => {
        console.log(`   ${index + 1}. ${tenant.firstName} ${tenant.lastName} (${tenant.lotId}) - ${tenant.status} - Created: ${tenant.createdAt}`);
      });
      
      // Keep the first (oldest) record, update the rest
      const tenantsToUpdate = tenantsWithEmail.rows.slice(1);
      
      for (let i = 0; i < tenantsToUpdate.length; i++) {
        const tenant = tenantsToUpdate[i];
        const newEmail = `${email}_duplicate_${i + 1}`;
        
        console.log(`   🔄 Updating tenant ${tenant.firstName} ${tenant.lastName} (${tenant.id}) email to: ${newEmail}`);
        
        await db.update(tenants)
          .set({ email: newEmail })
          .where(eq(tenants.id, tenant.id));
      }
    }
    
    console.log('\n✅ Duplicate emails have been resolved!');
    console.log('📝 Note: Duplicate emails have been updated with "_duplicate_N" suffix');
    console.log('   You may want to manually review and update these email addresses');
    console.log('   to proper unique email addresses for the tenants.');
    
  } catch (error) {
    console.error('❌ Error fixing duplicates:', error);
  }
}

// Run the fix
fixDuplicateTenantEmails()
  .then(() => {
    console.log('\n🎉 Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
