const { pool } = require('../../config/db');

/**
 * Migration: Align `subscriptions` table with Stage 08 requirements
 * 
 * Safe and Idempotent:
 * - Checks existing columns in INFORMATION_SCHEMA before ALTER TABLE
 * - Adds:
 *   plan_id (INT NULL) - direct link to the primary plan
 *   start_date (DATE NULL)
 *   end_date (DATE NULL)
 *   next_billing_date (DATE NULL)
 *   quantity (INT NOT NULL DEFAULT 1)
 *   unit_price (DECIMAL(12,2) NOT NULL DEFAULT 0.00)
 *   total_amount (DECIMAL(12,2) NOT NULL DEFAULT 0.00)
 *   notes (TEXT NULL)
 * - Updates status ENUM to include: 'draft', 'active', 'paused', 'cancelled', 'expired'
 * - Updates billing_cycle to support: 'Daily', 'Weekly', 'Monthly', 'Yearly'
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 08 Subscriptions Table Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect `subscriptions` table columns
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'subscriptions'`,
      [dbName]
    );
    const colNames = cols.map(c => c.COLUMN_NAME);

    // plan_id
    if (!colNames.includes('plan_id')) {
      console.log('  Adding plan_id column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN plan_id INT NULL AFTER customer_id`
      );
      console.log('  ✓ Added plan_id');
    }

    // start_date
    if (!colNames.includes('start_date')) {
      console.log('  Adding start_date column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN start_date DATE NULL AFTER plan_id`
      );
      console.log('  ✓ Added start_date');
    }

    // end_date
    if (!colNames.includes('end_date')) {
      console.log('  Adding end_date column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN end_date DATE NULL AFTER start_date`
      );
      console.log('  ✓ Added end_date');
    }

    // next_billing_date
    if (!colNames.includes('next_billing_date')) {
      console.log('  Adding next_billing_date column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN next_billing_date DATE NULL AFTER end_date`
      );
      console.log('  ✓ Added next_billing_date');
    }

    // quantity
    if (!colNames.includes('quantity')) {
      console.log('  Adding quantity column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN quantity INT NOT NULL DEFAULT 1 AFTER billing_interval_count`
      );
      console.log('  ✓ Added quantity');
    }

    // unit_price
    if (!colNames.includes('unit_price')) {
      console.log('  Adding unit_price column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER quantity`
      );
      console.log('  ✓ Added unit_price');
    }

    // total_amount
    if (!colNames.includes('total_amount')) {
      console.log('  Adding total_amount column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit_price`
      );
      console.log('  ✓ Added total_amount');
    }

    // notes
    if (!colNames.includes('notes')) {
      console.log('  Adding notes column...');
      await connection.query(
        `ALTER TABLE subscriptions ADD COLUMN notes TEXT NULL AFTER cancel_reason`
      );
      console.log('  ✓ Added notes');
    }

    // Update status ENUM to support 'draft', 'active', 'paused', 'cancelled', 'expired'
    console.log('  Updating status ENUM...');
    await connection.query(
      `ALTER TABLE subscriptions MODIFY COLUMN status ENUM('draft', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired') NOT NULL DEFAULT 'draft'`
    );
    console.log('  ✓ Updated status ENUM');

    // Update billing_cycle column to VARCHAR(20) or broader ENUM so case differences ('Monthly' vs 'monthly') never fail
    console.log('  Updating billing_cycle column...');
    await connection.query(
      `ALTER TABLE subscriptions MODIFY COLUMN billing_cycle VARCHAR(20) NOT NULL DEFAULT 'Monthly'`
    );
    console.log('  ✓ Updated billing_cycle column');

    // Make current_period_start and current_period_end nullable if they were NOT NULL
    await connection.query(
      `ALTER TABLE subscriptions MODIFY COLUMN current_period_start DATE NULL`
    );
    await connection.query(
      `ALTER TABLE subscriptions MODIFY COLUMN current_period_end DATE NULL`
    );

    console.log('\n✅ Subscriptions migration applied successfully.\n');
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
