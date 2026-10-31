const { pool } = require('../../config/db');

/**
 * Migration: Add password reset token columns, indexes, and update role enum in users table
 * 
 * Safe and idempotent:
 * - Checks column existence in INFORMATION_SCHEMA before ADD COLUMN
 * - Checks index existence in INFORMATION_SCHEMA before ADD INDEX
 * - Safe to run multiple times without failure
 * - Preserves all existing rows and data intact
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Add Reset Password Columns & Customer Role');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Check existing columns in `users`
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [dbName]
    );

    const columnNames = columns.map(c => c.COLUMN_NAME);
    const roleCol = columns.find(c => c.COLUMN_NAME === 'role');

    // 2. Add reset_password_token if not present
    if (!columnNames.includes('reset_password_token')) {
      console.log('  Adding column: reset_password_token VARCHAR(255) NULL...');
      await connection.query(
        `ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(255) NULL AFTER status`
      );
      console.log('  ✓ Added reset_password_token');
    } else {
      console.log('  - reset_password_token column already exists.');
    }

    // 3. Add reset_password_expires if not present
    if (!columnNames.includes('reset_password_expires')) {
      console.log('  Adding column: reset_password_expires DATETIME NULL...');
      await connection.query(
        `ALTER TABLE users ADD COLUMN reset_password_expires DATETIME NULL AFTER reset_password_token`
      );
      console.log('  ✓ Added reset_password_expires');
    } else {
      console.log('  - reset_password_expires column already exists.');
    }

    // 4. Ensure `role` ENUM includes 'customer'
    if (roleCol && !roleCol.COLUMN_TYPE.includes("'customer'")) {
      console.log('  Updating role ENUM to include \'customer\'...');
      await connection.query(
        `ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'manager', 'staff', 'customer') NOT NULL DEFAULT 'customer'`
      );
      console.log('  ✓ Updated role column ENUM definition');
    } else {
      console.log('  - role ENUM already supports \'customer\'.');
    }

    // 5. Add index on reset_password_token if missing
    const [indexes] = await connection.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_reset_token'`,
      [dbName]
    );

    if (indexes.length === 0) {
      console.log('  Creating index idx_users_reset_token...');
      await connection.query(
        `CREATE INDEX idx_users_reset_token ON users (reset_password_token)`
      );
      console.log('  ✓ Created index idx_users_reset_token');
    } else {
      console.log('  - idx_users_reset_token index already exists.');
    }

    console.log('\n✅ Database migration completed successfully.\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration };
