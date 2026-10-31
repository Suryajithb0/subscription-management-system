const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

/**
 * Reusable JWT Authentication Middleware
 * Prioritizes HTTP-only cookies, with fallback to Bearer header for API tools.
 * Validates access token and verifies active account status.
 */
const authenticateToken = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check secure HTTP-only cookie (primary browser strategy)
    if (req.cookies && req.cookies.subflow_token) {
      token = req.cookies.subflow_token;
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)subflow_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    // 2. Fallback to Authorization: Bearer header (for external API tools and automated tests)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No session cookie or access token provided.'
      });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired access token.'
      });
    }

    // Verify user still exists and is active in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been removed.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Access denied. Please contact an administrator.`
      });
    }

    // Attach authenticated user to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    };

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateToken,
  verifyToken: authenticateToken // Backward compatibility
};
