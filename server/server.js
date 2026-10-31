const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { pool, testConnection } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const productRoutes = require('./routes/productRoutes');
const planRoutes = require('./routes/planRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const billingScheduler = require('./services/billingScheduler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration supporting credentials from frontend origin
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. General Server Health Check Endpoint (GET /api/health)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'SubFlow API Server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Database Health Check Endpoint (GET /api/health/db)
app.get('/api/health/db', async (req, res) => {
  const startTime = Date.now();
  try {
    const connection = await pool.getConnection();
    const [result] = await connection.query('SELECT 1 AS status');
    const [tables] = await connection.query('SHOW TABLES');
    connection.release();

    const responseTimeMs = Date.now() - startTime;

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      dbName: process.env.DB_NAME || 'subflow_db',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      tableCount: tables.length,
      latencyMs: responseTimeMs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/products', productRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);

// 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server
const startServer = async () => {
  // Test database connection pool on boot
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`[Database] Connected successfully to MySQL database '${dbStatus.database}' at ${dbStatus.host}:${dbStatus.port}`);
  } else {
    console.warn(`[Database Warning] MySQL connection failed on boot: ${dbStatus.error}`);
    console.warn('[Database Notice] Backend server will continue running in standalone mode.');
  }

  // Initialize automated recurring billing scheduler
  billingScheduler.startScheduler();

  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 SubFlow Backend running on port ${PORT}`);
    console.log(`🩺 Health Check:    http://localhost:${PORT}/api/health`);
    console.log(`🗄️ DB Health Check: http://localhost:${PORT}/api/health/db`);
    console.log(`===============================================`);
  });
};

// Start server if executed directly
if (require.main === module) {
  startServer();
}

module.exports = app;
