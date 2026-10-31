const Analytics = require('../models/Analytics');

/**
 * GET /api/dashboard/analytics
 * Fetches real-time database metrics for the dashboard
 */
const getDashboardAnalytics = async (req, res, next) => {
  try {
    let scopedUserId = null;
    if (req.user && req.user.role === 'customer') {
      scopedUserId = req.user.id;
    }

    const data = await Analytics.getDashboardAnalytics(scopedUserId);

    return res.status(200).json({
      success: true,
      message: 'Dashboard analytics retrieved successfully.',
      data
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardAnalytics
};
