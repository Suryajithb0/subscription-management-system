const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Reusable MySQL Connection Pool using mysql2/promise
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'subflow_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Helper function to test database connectivity
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1 AS status');
    connection.release();
    return {
      connected: true,
      database: process.env.DB_NAME || 'subflow_db',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306
    };
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    return {
      connected: false,
      error: error.message
    };
  }
};

module.exports = {
  pool,
  testConnection
};
