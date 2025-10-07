// Test company manager access

async function testCompanyManager() {
  try {
    // Login as company manager
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'developer+cm@bluepaperclip.com',
        password: 'password'
      })
    });

    if (!loginResponse.ok) {
      console.error('Login failed:', await loginResponse.text());
      return;
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.accessToken;
    const user = loginData.user;

    console.log('Company manager logged in:', user);

    // Test company manager parks endpoint
    const parksResponse = await fetch('http://localhost:5000/api/company-manager/parks', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!parksResponse.ok) {
      console.error('Failed to get company parks:', await parksResponse.text());
      return;
    }

    const parksData = await parksResponse.json();
    console.log('Company parks:', parksData);

    // Test company manager stats endpoint
    const statsResponse = await fetch('http://localhost:5000/api/company-manager/stats', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!statsResponse.ok) {
      console.error('Failed to get company stats:', await statsResponse.text());
      return;
    }

    const statsData = await statsResponse.json();
    console.log('Company stats:', statsData);

    console.log('✅ Company manager access working correctly!');

  } catch (error) {
    console.error('Error:', error);
  }
}

testCompanyManager();
