const fetch = require('node-fetch');
require('dotenv/config');

async function testApiUpdate() {
  try {
    // First, let's try to get companies to see the current data
    console.log('Testing GET /api/companies...');
    const getResponse = await fetch('http://localhost:5000/api/companies', {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!getResponse.ok) {
      console.log('GET failed:', getResponse.status, await getResponse.text());
      return;
    }
    
    const companies = await getResponse.json();
    console.log('Current companies:', companies.length);
    
    if (companies.length === 0) {
      console.log('No companies to test with');
      return;
    }
    
    const company = companies[0];
    console.log('Testing with company:', company.name, company.id);
    
    // Now test updating the company
    console.log('\nTesting PATCH /api/companies/:id...');
    const updateData = {
      name: company.name,
      description: company.description,
      address: 'API Test Address 456',
      city: 'API Test City',
      state: 'API Test State',
      zipCode: '67890',
      phone: '555-987-6543',
      email: 'apitest@example.com'
    };
    
    console.log('Sending update data:', updateData);
    
    const updateResponse = await fetch(`http://localhost:5000/api/companies/${company.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      console.log('PATCH failed:', updateResponse.status, await updateResponse.text());
      return;
    }
    
    const updatedCompany = await updateResponse.json();
    console.log('Updated company response:', updatedCompany);
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Wait a bit for server to start, then test
setTimeout(testApiUpdate, 3000);
