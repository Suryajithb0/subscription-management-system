const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPaymentById,
  recordPayment,
  patchPaymentStatus
} = require('../controllers/paymentController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All payment endpoints require JWT authentication
router.use(authenticateToken);

// List payments (Admin, Staff, Customer with user-scoping)
router.get('/', getPayments);

// Get single payment details (Admin, Staff, Customer with ownership check)
router.get('/:id', getPaymentById);

// Record payment (Admin & Staff)
router.post('/', authorizeRoles('admin', 'staff'), recordPayment);

// Update payment status (Admin & Staff)
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchPaymentStatus);

module.exports = router;
