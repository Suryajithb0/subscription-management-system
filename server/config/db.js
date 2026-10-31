const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'subflow_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper function to test database connectivity
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Successfully connected to MySQL database: ${process.env.DB_NAME || 'subflow_db'}`);
    connection.release();
    return true;
  } catch (error) {
    console.warn(`[Database Warning] MySQL connection failed: ${error.message}`);
    console.warn('[Database Notice] Backend server will continue running in standalone mode.');
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
