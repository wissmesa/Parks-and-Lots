const { Pool } = require('@neondatabase/serverless');
require('dotenv/config');

async function testUpdate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Get the first company
    const companiesResult = await pool.query('SELECT * FROM companies LIMIT 1;');
    const company = companiesResult.rows[0];
    
    if (!company) {
      console.log('No companies found to test with');
      return;
    }
    
    console.log('Before update:');
    console.log(company);
    
    // Test updating the company
    const updateResult = await pool.query(`
      UPDATE companies 
      SET address = $1, city = $2, state = $3, zip_code = $4, phone = $5, email = $6
      WHERE id = $7
      RETURNING *;
    `, [
      'Test Address 123',
      'Test City', 
      'Test State',
      '12345',
      '555-123-4567',
      'test@example.com',
      company.id
    ]);
    
    console.log('\nAfter update:');
    console.log(updateResult.rows[0]);
    
  } catch (error) {
    console.error('Error testing update:', error);
  } finally {
    await pool.end();
  }
}

testUpdate();
