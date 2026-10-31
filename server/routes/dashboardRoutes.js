const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Real-time analytics endpoint
router.get('/analytics', getDashboardAnalytics);

module.exports = router;
