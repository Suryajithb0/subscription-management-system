const express = require('express');
const router = express.Router();
const {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  patchSubscriptionStatus,
  getSubscriptionInvoices,
} = require('../controllers/subscriptionController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All subscription endpoints require JWT authentication
router.use(authenticateToken);

// Read endpoints: Admin, Staff, and Customer (ownership checked in controller)
router.get('/', getSubscriptions);
router.get('/:id', getSubscriptionById);
router.get('/:id/invoices', getSubscriptionInvoices);

// Modification & Lifecycle Management: Admin and Staff
router.post('/', authorizeRoles('admin', 'staff'), createSubscription);
router.put('/:id', authorizeRoles('admin', 'staff'), updateSubscription);
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchSubscriptionStatus);

module.exports = router;
