const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const seedAdmin = async () => {
  try {
    const adminEmail = 'admin@subflow.io';
    const adminPassword = 'Admin@SubFlow2026!';
    const adminName = 'System Administrator';

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (existing.length > 0) {
      console.log(`[Seed] Admin user already exists (id: ${existing[0].id}).`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      [adminName, adminEmail, passwordHash, 'admin', 'active']
    );

    console.log('========================================================');
    console.log('✅ Admin account seeded successfully:');
    console.log(`   ID:       ${result.insertId}`);
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     admin`);
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error] Failed to seed admin user:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  seedAdmin();
}

module.exports = { seedAdmin };
