const bcrypt = require('bcryptjs');

async function hashPassword() {
  const password = 'password';
  const hash = await bcrypt.hash(password, 12);
  console.log('Hashed password:', hash);
}

hashPassword();
