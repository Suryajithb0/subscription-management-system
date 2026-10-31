const { pool } = require('../../config/db');

/**
 * Migration: Align `plans` table with Stage 06 specifications
 * 
 * Safe and Idempotent:
 * - Checks existing columns in INFORMATION_SCHEMA before ALTER TABLE
 * - Adds:
 *   description (TEXT NULL)
 *   billing_cycle (ENUM('Daily','Weekly','Monthly','Yearly') DEFAULT 'Monthly')
 *   minimum_quantity (INT NOT NULL DEFAULT 1)
 *   available_from (DATETIME NULL)
 *   available_until (DATETIME NULL)
 *   auto_close (BOOLEAN NOT NULL DEFAULT FALSE)
 *   allow_pause (BOOLEAN NOT NULL DEFAULT TRUE)
 *   allow_early_close (BOOLEAN NOT NULL DEFAULT TRUE)
 *   allow_renewal (BOOLEAN NOT NULL DEFAULT TRUE)
 * - Relaxes `code` to allow automatic generation or NULL
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 06 Plans Table Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect `plans` table columns
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'plans'`,
      [dbName]
    );
    const colNames = cols.map(c => c.COLUMN_NAME);

    // description
    if (!colNames.includes('description')) {
      console.log('  Adding description column...');
      await connection.query(`ALTER TABLE plans ADD COLUMN description TEXT NULL AFTER name`);
      console.log('  ✓ Added description');
    }

    // billing_cycle
    if (!colNames.includes('billing_cycle')) {
      console.log('  Adding billing_cycle column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN billing_cycle ENUM('Daily', 'Weekly', 'Monthly', 'Yearly') NOT NULL DEFAULT 'Monthly' AFTER price`
      );
      console.log('  ✓ Added billing_cycle');
    }

    // minimum_quantity
    if (!colNames.includes('minimum_quantity')) {
      console.log('  Adding minimum_quantity column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN minimum_quantity INT NOT NULL DEFAULT 1 AFTER billing_cycle`
      );
      console.log('  ✓ Added minimum_quantity');
    }

    // available_from
    if (!colNames.includes('available_from')) {
      console.log('  Adding available_from column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN available_from DATETIME NULL AFTER minimum_quantity`
      );
      console.log('  ✓ Added available_from');
    }

    // available_until
    if (!colNames.includes('available_until')) {
      console.log('  Adding available_until column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN available_until DATETIME NULL AFTER available_from`
      );
      console.log('  ✓ Added available_until');
    }

    // auto_close
    if (!colNames.includes('auto_close')) {
      console.log('  Adding auto_close column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN auto_close BOOLEAN NOT NULL DEFAULT FALSE AFTER available_until`
      );
      console.log('  ✓ Added auto_close');
    }

    // allow_pause
    if (!colNames.includes('allow_pause')) {
      console.log('  Adding allow_pause column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN allow_pause BOOLEAN NOT NULL DEFAULT TRUE AFTER auto_close`
      );
      console.log('  ✓ Added allow_pause');
    }

    // allow_early_close
    if (!colNames.includes('allow_early_close')) {
      console.log('  Adding allow_early_close column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN allow_early_close BOOLEAN NOT NULL DEFAULT TRUE AFTER allow_pause`
      );
      console.log('  ✓ Added allow_early_close');
    }

    // allow_renewal
    if (!colNames.includes('allow_renewal')) {
      console.log('  Adding allow_renewal column...');
      await connection.query(
        `ALTER TABLE plans ADD COLUMN allow_renewal BOOLEAN NOT NULL DEFAULT TRUE AFTER allow_early_close`
      );
      console.log('  ✓ Added allow_renewal');
    }

    // Make code nullable if present to simplify plan creation
    if (colNames.includes('code')) {
      await connection.query(`ALTER TABLE plans MODIFY COLUMN code VARCHAR(50) NULL`);
    }

    console.log('\n✅ Plans table migration applied successfully.\n');
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
