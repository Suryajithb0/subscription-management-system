const { pool } = require('../../config/db');

/**
 * Migration: Stage 09 Align Invoices and Invoice Items tables
 * 
 * Safe and Idempotent:
 * - Checks existing columns in INFORMATION_SCHEMA
 * - Extends status ENUM to include 'draft', 'pending', 'partially_paid', 'paid', 'overdue', 'cancelled'
 * - Makes billing_period_start and billing_period_end nullable for manual standalone invoices
 * - Adds billing_period, tax_amount, discount_amount, balance_due columns to invoices
 * - Adds tax_rate column to invoice_items
 * - Seeds default tax rates if taxes table is empty
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 09 Invoices Table Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect `invoices` table columns
    const [invCols] = await connection.query(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoices'`,
      [dbName]
    );
    const invColMap = {};
    invCols.forEach(c => { invColMap[c.COLUMN_NAME] = c; });

    // Ensure status enum supports all required statuses
    console.log('  Updating invoices.status ENUM...');
    await connection.query(
      `ALTER TABLE invoices MODIFY COLUMN status ENUM('draft', 'pending', 'open', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void', 'uncollectible') NOT NULL DEFAULT 'draft'`
    );
    console.log('  ✓ Updated invoices.status ENUM');

    // Make billing_period_start and billing_period_end nullable if not already
    if (invColMap['billing_period_start'] && invColMap['billing_period_start'].IS_NULLABLE === 'NO') {
      console.log('  Making billing_period_start NULL-able...');
      await connection.query(`ALTER TABLE invoices MODIFY COLUMN billing_period_start DATE NULL`);
      console.log('  ✓ billing_period_start is now NULL-able');
    }
    if (invColMap['billing_period_end'] && invColMap['billing_period_end'].IS_NULLABLE === 'NO') {
      console.log('  Making billing_period_end NULL-able...');
      await connection.query(`ALTER TABLE invoices MODIFY COLUMN billing_period_end DATE NULL`);
      console.log('  ✓ billing_period_end is now NULL-able');
    }

    // Add billing_period varchar(100) if not present
    if (!invColMap['billing_period']) {
      console.log('  Adding billing_period column...');
      await connection.query(`ALTER TABLE invoices ADD COLUMN billing_period VARCHAR(100) NULL AFTER billing_period_end`);
      console.log('  ✓ Added billing_period');
    }

    // Add tax_amount decimal(12,2) if not present
    if (!invColMap['tax_amount']) {
      console.log('  Adding tax_amount column...');
      await connection.query(`ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER tax_total`);
      console.log('  ✓ Added tax_amount');
    }

    // Add discount_amount decimal(12,2) if not present
    if (!invColMap['discount_amount']) {
      console.log('  Adding discount_amount column...');
      await connection.query(`ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER discount_total`);
      console.log('  ✓ Added discount_amount');
    }

    // Add balance_due decimal(12,2) if not present
    if (!invColMap['balance_due']) {
      console.log('  Adding balance_due column...');
      await connection.query(`ALTER TABLE invoices ADD COLUMN balance_due DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER amount_due`);
      console.log('  ✓ Added balance_due');
    }

    // 2. Inspect `invoice_items` table columns
    const [itemCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_items'`,
      [dbName]
    );
    const itemColNames = itemCols.map(c => c.COLUMN_NAME);

    // Add tax_rate decimal(6,4) if not present
    if (!itemColNames.includes('tax_rate')) {
      console.log('  Adding tax_rate column to invoice_items...');
      await connection.query(`ALTER TABLE invoice_items ADD COLUMN tax_rate DECIMAL(6,4) NULL DEFAULT 0.0000 AFTER tax_id`);
      console.log('  ✓ Added tax_rate to invoice_items');
    }

    // 3. Seed default taxes if taxes table is empty
    const [taxCountRows] = await connection.query('SELECT COUNT(*) as cnt FROM taxes');
    if (taxCountRows[0].cnt === 0) {
      console.log('  Seeding default tax records into taxes table...');
      await connection.query(`
        INSERT INTO taxes (name, rate, type, country, is_compound, is_active, created_at, updated_at) VALUES
        ('Tax Exempt (0%)', 0.0000, 'percentage', 'United States', 0, 1, NOW(), NOW()),
        ('Standard Sales Tax (8.25%)', 0.0825, 'percentage', 'United States', 0, 1, NOW(), NOW()),
        ('Standard VAT (10%)', 0.1000, 'percentage', 'United States', 0, 1, NOW(), NOW()),
        ('Reduced VAT (5%)', 0.0500, 'percentage', 'United States', 0, 1, NOW(), NOW()),
        ('GST (18%)', 0.1800, 'percentage', 'United States', 0, 1, NOW(), NOW())
      `);
      console.log('  ✓ Seeded default tax records');
    }

    console.log('========================================================');
    console.log('✅ Stage 09 Invoices Migration Completed Successfully');
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
