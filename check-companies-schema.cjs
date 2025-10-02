const { Pool } = require('@neondatabase/serverless');
require('dotenv/config');

async function checkSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check the companies table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'companies' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Companies table schema:');
    console.table(result.rows);
    
    // Also check if there are any companies in the table
    const companiesResult = await pool.query('SELECT * FROM companies LIMIT 1;');
    console.log('\nSample company data:');
    console.log(companiesResult.rows[0] || 'No companies found');
    
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
