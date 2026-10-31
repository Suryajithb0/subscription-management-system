const { authenticateToken, verifyToken } = require('./auth.middleware');

module.exports = {
  authenticateToken,
  verifyToken
};
