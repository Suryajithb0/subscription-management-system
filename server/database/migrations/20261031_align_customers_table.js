const { pool } = require('../../config/db');

/**
 * Migration: Align `customers` table with Stage 07 convenience columns
 * 
 * Safe and Idempotent:
 * - Checks existing columns in INFORMATION_SCHEMA before ALTER TABLE
 * - Adds `name` (VARCHAR(200) NULL) so full name can be queried/set directly, or computed
 * - Adds `address` (TEXT NULL) as an alias for general address
 * - Keeps first_name, last_name, billing_address fully backward compatible
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 07 Customers Table Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect `customers` table columns
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers'`,
      [dbName]
    );
    const colNames = cols.map(c => c.COLUMN_NAME);

    // Make first_name and last_name nullable to support simple `name`
    if (colNames.includes('first_name')) {
      await connection.query(`ALTER TABLE customers MODIFY COLUMN first_name VARCHAR(100) NULL`);
    }
    if (colNames.includes('last_name')) {
      await connection.query(`ALTER TABLE customers MODIFY COLUMN last_name VARCHAR(100) NULL`);
    }

    // Add `name` column if not present
    if (!colNames.includes('name')) {
      console.log('  Adding name column to customers...');
      await connection.query(
        `ALTER TABLE customers ADD COLUMN name VARCHAR(200) NULL AFTER user_id`
      );
      // Backfill name from first_name and last_name if any rows exist
      await connection.query(
        `UPDATE customers SET name = CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) WHERE name IS NULL`
      );
      console.log('  ✓ Added name column');
    }

    // Add `address` column if not present
    if (!colNames.includes('address')) {
      console.log('  Adding address column to customers...');
      await connection.query(
        `ALTER TABLE customers ADD COLUMN address TEXT NULL AFTER company_name`
      );
      await connection.query(
        `UPDATE customers SET address = billing_address WHERE address IS NULL AND billing_address IS NOT NULL`
      );
      console.log('  ✓ Added address column');
    }

    console.log('\n✅ Customers table migration applied successfully.\n');
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
