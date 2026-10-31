const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  createStaff,
  getStaffList,
  forgotPassword,
  resetPassword,
  getMe,
  getCustomerProfile
} = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles, checkCustomerOwnership } = require('../middleware/role.middleware');

// Public Authentication Endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected Staff Management (Admin Only)
router.get('/staff', authenticateToken, authorizeRoles('admin'), getStaffList);
router.post('/staff/create', authenticateToken, authorizeRoles('admin'), createStaff);

// Protected User Profile Endpoint
router.get('/me', authenticateToken, getMe);

// Protected Customer-Specific Endpoint with Ownership Check
// (Admin and Staff can access; Customers can ONLY access their own resource)
router.get(
  '/customer/:customerId/profile',
  authenticateToken,
  checkCustomerOwnership((req) => req.params.customerId),
  getCustomerProfile
);

module.exports = router;
