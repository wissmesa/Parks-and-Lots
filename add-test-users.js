import bcrypt from 'bcryptjs';
import { storage } from './server/storage.ts';

async function addTestUsers() {
  try {
    console.log('Adding test users to the development database...');
    
    // Hash the password
    const password = 'password';
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Test users data
    const testUsers = [
      {
        email: 'developer@example.com',
        passwordHash: passwordHash,
        fullName: 'Developer Admin',
        role: 'ADMIN',
        isActive: true
      },
      {
        email: 'manager@greenvalley.com',
        passwordHash: passwordHash,
        fullName: 'Green Valley Manager',
        role: 'MANAGER',
        isActive: true
      }
    ];
    
    // Check if users already exist
    for (const userData of testUsers) {
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }
      
      // Create the user
      const newUser = await storage.createUser(userData);
      console.log(`✅ Created user: ${newUser.email} (${newUser.role})`);
    }
    
    console.log('✅ Test users added successfully!');
    console.log('\nTest users:');
    console.log('Admin: developer@example.com');
    console.log('Manager: manager@greenvalley.com');
    console.log('Password for both: password');
    
  } catch (error) {
    console.error('❌ Error adding test users:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the script
addTestUsers();
