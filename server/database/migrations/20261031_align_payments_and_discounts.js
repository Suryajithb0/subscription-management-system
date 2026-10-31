const { pool } = require('../../config/db');

/**
 * Migration: Stage 10 Align Payments and Discounts tables
 * 
 * Safe and Idempotent:
 * - Checks existing columns in INFORMATION_SCHEMA
 * - Extends payments.payment_method ENUM to support ('credit_card', 'card', 'bank_transfer', 'upi', 'cash', 'paypal', 'other')
 * - Adds name, min_purchase_amount, max_discount_amount, per_customer_limit, usage_limit, expiry_date to discounts table
 * - Extends discounts.type ENUM to ('percentage', 'fixed', 'fixed_amount')
 * - Seeds initial standard coupons for testing and operational use
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 10 Payments & Discounts Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect & Align `payments` table
    console.log('  Inspecting `payments` table...');
    await connection.query(
      `ALTER TABLE payments MODIFY COLUMN payment_method ENUM('credit_card', 'card', 'bank_transfer', 'upi', 'cash', 'paypal', 'other') NOT NULL`
    );
    console.log('  ✓ Updated payments.payment_method ENUM');

    // 2. Inspect & Align `discounts` table
    const [discCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'discounts'`,
      [dbName]
    );
    const discColNames = discCols.map(c => c.COLUMN_NAME);

    // Update discounts.type ENUM to support 'fixed' as well as 'fixed_amount'
    console.log('  Updating discounts.type ENUM...');
    await connection.query(
      `ALTER TABLE discounts MODIFY COLUMN type ENUM('percentage', 'fixed', 'fixed_amount') NOT NULL DEFAULT 'percentage'`
    );
    console.log('  ✓ Updated discounts.type ENUM');

    // Add name column if missing
    if (!discColNames.includes('name')) {
      console.log('  Adding name column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN name VARCHAR(100) NULL AFTER id`);
      console.log('  ✓ Added discounts.name');
    }

    // Add min_purchase_amount column if missing
    if (!discColNames.includes('min_purchase_amount')) {
      console.log('  Adding min_purchase_amount column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN min_purchase_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER value`);
      console.log('  ✓ Added discounts.min_purchase_amount');
    }

    // Add max_discount_amount column if missing
    if (!discColNames.includes('max_discount_amount')) {
      console.log('  Adding max_discount_amount column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN max_discount_amount DECIMAL(12,2) NULL AFTER min_purchase_amount`);
      console.log('  ✓ Added discounts.max_discount_amount');
    }

    // Add per_customer_limit column if missing
    if (!discColNames.includes('per_customer_limit')) {
      console.log('  Adding per_customer_limit column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN per_customer_limit INT(11) NOT NULL DEFAULT 1 AFTER max_uses`);
      console.log('  ✓ Added discounts.per_customer_limit');
    }

    // Add usage_limit column if missing (synced with max_uses)
    if (!discColNames.includes('usage_limit')) {
      console.log('  Adding usage_limit column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN usage_limit INT(11) NULL AFTER max_uses`);
      console.log('  ✓ Added discounts.usage_limit');
    }

    // Add expiry_date column if missing (synced with end_date)
    if (!discColNames.includes('expiry_date')) {
      console.log('  Adding expiry_date column to discounts...');
      await connection.query(`ALTER TABLE discounts ADD COLUMN expiry_date DATE NULL AFTER end_date`);
      console.log('  ✓ Added discounts.expiry_date');
    }

    // 3. Seed initial standard coupons if discounts table is empty
    const [discCountRows] = await connection.query('SELECT COUNT(*) as cnt FROM discounts');
    if (discCountRows[0].cnt === 0) {
      console.log('  Seeding default promotional discounts...');
      await connection.query(`
        INSERT INTO discounts (
          name, code, description, type, value, min_purchase_amount, max_discount_amount,
          start_date, end_date, expiry_date, max_uses, usage_limit, per_customer_limit, is_active, created_at, updated_at
        ) VALUES 
        (
          'Welcome New Subscriber', 'WELCOME10', '10% discount on first subscription invoice',
          'percentage', 10.00, 50.00, 50.00,
          CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
          500, 500, 1, 1, NOW(), NOW()
        ),
        (
          'Enterprise Launch Flat $50', 'LAUNCH50', '$50 flat discount on enterprise purchases',
          'fixed', 50.00, 150.00, NULL,
          CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), DATE_ADD(CURDATE(), INTERVAL 6 MONTH),
          200, 200, 1, 1, NOW(), NOW()
        ),
        (
          'Flash Sale 20% Off', 'FLASH20', '20% off all catalog services and subscriptions',
          'percentage', 20.00, 100.00, 100.00,
          CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), DATE_ADD(CURDATE(), INTERVAL 30 DAY),
          100, 100, 1, 1, NOW(), NOW()
        )
      `);
      console.log('  ✓ Seeded default promotional discounts (WELCOME10, LAUNCH50, FLASH20)');
    }

    console.log('========================================================');
    console.log('✅ Stage 10 Payments & Discounts Migration Completed Successfully');
    console.log('========================================================');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runMigration;
