const { pool } = require('../../config/db');

/**
 * Migration: Align products and product_variants tables with Stage 05 specifications
 * 
 * Safe and Idempotent:
 * - Checks column existence in INFORMATION_SCHEMA before ADD COLUMN
 * - Preserves existing data
 * - Adds product_type, sales_price, cost_price, notes to products
 * - Adds variant_name, variant_value, additional_price to product_variants
 */
async function runMigration() {
  console.log('========================================================');
  console.log('🔄 Running Migration: Stage 05 Products & Variants Alignment');
  console.log('========================================================');

  const connection = await pool.getConnection();
  try {
    const dbName = process.env.DB_NAME || 'subflow_db';

    // 1. Inspect `products` table columns
    const [prodCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products'`,
      [dbName]
    );
    const prodColNames = prodCols.map(c => c.COLUMN_NAME);

    // Make code nullable or keep default if exists
    if (!prodColNames.includes('product_type')) {
      console.log('  Adding product_type column to products...');
      await connection.query(
        `ALTER TABLE products ADD COLUMN product_type VARCHAR(50) NOT NULL DEFAULT 'digital' AFTER description`
      );
      console.log('  ✓ Added product_type');
    }

    if (!prodColNames.includes('sales_price')) {
      console.log('  Adding sales_price column to products...');
      await connection.query(
        `ALTER TABLE products ADD COLUMN sales_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER product_type`
      );
      console.log('  ✓ Added sales_price');
    }

    if (!prodColNames.includes('cost_price')) {
      console.log('  Adding cost_price column to products...');
      await connection.query(
        `ALTER TABLE products ADD COLUMN cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER sales_price`
      );
      console.log('  ✓ Added cost_price');
    }

    if (!prodColNames.includes('notes')) {
      console.log('  Adding notes column to products...');
      await connection.query(
        `ALTER TABLE products ADD COLUMN notes TEXT NULL AFTER cost_price`
      );
      console.log('  ✓ Added notes');
    }

    // Ensure code has a safe default / NULL support if not explicitly provided
    if (prodColNames.includes('code')) {
      await connection.query(
        `ALTER TABLE products MODIFY COLUMN code VARCHAR(50) NULL`
      );
    }

    // 2. Inspect `product_variants` table columns
    const [varCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variants'`,
      [dbName]
    );
    const varColNames = varCols.map(c => c.COLUMN_NAME);

    if (!varColNames.includes('variant_name')) {
      console.log('  Adding variant_name column to product_variants...');
      await connection.query(
        `ALTER TABLE product_variants ADD COLUMN variant_name VARCHAR(100) NOT NULL DEFAULT '' AFTER product_id`
      );
      console.log('  ✓ Added variant_name');
    }

    if (!varColNames.includes('variant_value')) {
      console.log('  Adding variant_value column to product_variants...');
      await connection.query(
        `ALTER TABLE product_variants ADD COLUMN variant_value VARCHAR(100) NOT NULL DEFAULT '' AFTER variant_name`
      );
      console.log('  ✓ Added variant_value');
    }

    if (!varColNames.includes('additional_price')) {
      console.log('  Adding additional_price column to product_variants...');
      await connection.query(
        `ALTER TABLE product_variants ADD COLUMN additional_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER variant_value`
      );
      console.log('  ✓ Added additional_price');
    }

    // Ensure sku and name are flexible in product_variants
    if (varColNames.includes('sku')) {
      await connection.query(
        `ALTER TABLE product_variants MODIFY COLUMN sku VARCHAR(50) NULL`
      );
    }
    if (varColNames.includes('name')) {
      await connection.query(
        `ALTER TABLE product_variants MODIFY COLUMN name VARCHAR(100) NULL`
      );
    }

    console.log('\n✅ Products & Product Variants migration applied successfully.\n');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMigration };
