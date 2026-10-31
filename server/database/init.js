const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

// Expected 15 SubFlow tables in architectural sequence
const EXPECTED_TABLES = [
  'users',
  'customers',
  'products',
  'product_variants',
  'plans',
  'taxes',
  'quotations',
  'quotation_items',
  'subscriptions',
  'subscription_items',
  'invoices',
  'invoice_items',
  'discounts',
  'payments',
  'discount_usages'
];

/**
 * Parses SQL file into discrete statements while preserving formatting and stripping comments
 */
const parseSqlStatements = (sqlContent) => {
  return sqlContent
    .split(/;\s*$/m)
    .map(stmt => stmt.trim())
    .filter(stmt => {
      // Remove lines that are purely SQL comments
      const nonCommentLines = stmt
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('--') && !line.startsWith('/*'));
      return nonCommentLines.length > 0;
    });
};

/**
 * Initializes the database schema safely without dropping existing tables or records
 */
const initDatabase = async () => {
  console.log('====================================================');
  console.log('🔄 SubFlow Database Initializer: Starting Stage 02');
  console.log('====================================================');

  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found at: ${schemaPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(schemaPath, 'utf8');
  const statements = parseSqlStatements(sqlContent);

  console.log(`📖 Loaded schema.sql: Found ${statements.length} executable SQL statements.\n`);

  let connection;
  try {
    connection = await pool.getConnection();
    console.log(`🔌 Connected to MySQL database: ${process.env.DB_NAME || 'subflow_db'}\n`);

    // Execute each CREATE TABLE statement safely
    let executedCount = 0;
    for (const statement of statements) {
      if (statement.length === 0) continue;
      
      // Extract table name if present for clear logging
      const tableMatch = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      const tableName = tableMatch ? tableMatch[1] : `Statement #${executedCount + 1}`;

      await connection.query(statement);
      executedCount++;
      console.log(`  ✓ Initialized table: ${tableName}`);
    }

    console.log(`\n🎉 Executed ${executedCount} statements successfully.\n`);

    // Verification step: Query all existing tables in the database
    const [rows] = await connection.query('SHOW TABLES');
    const tableKey = Object.keys(rows[0] || {})[0];
    const existingTables = rows.map(r => r[tableKey]);

    console.log('====================================================');
    console.log(`📋 Verification Report: Found ${existingTables.length} tables in ${process.env.DB_NAME || 'subflow_db'}`);
    console.log('====================================================');

    const missingTables = EXPECTED_TABLES.filter(t => !existingTables.includes(t));

    EXPECTED_TABLES.forEach((tableName, index) => {
      const exists = existingTables.includes(tableName);
      console.log(`  ${index + 1}. [${exists ? '✓ EXISTS' : '✗ MISSING'}] ${tableName}`);
    });

    if (missingTables.length > 0) {
      console.error(`\n⚠️ Warning: Missing ${missingTables.length} expected tables: ${missingTables.join(', ')}`);
      process.exit(1);
    } else {
      console.log(`\n✅ All ${EXPECTED_TABLES.length} SubFlow database tables are verified and ready.`);
    }

  } catch (error) {
    console.error(`\n❌ Database initialization failed: ${error.message}`);
    if (error.sql) {
      console.error(`Faulty SQL snippet:\n${error.sql.substring(0, 200)}...`);
    }
    process.exit(1);
  } finally {
    if (connection) connection.release();
    // Do not hold process open if invoked as CLI script
    process.exit(0);
  }
};

// Execute if run directly from CLI
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, EXPECTED_TABLES };
