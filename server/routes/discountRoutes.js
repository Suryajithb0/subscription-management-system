const express = require('express');
const router = express.Router();
const {
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscount
} = require('../controllers/discountController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All discount endpoints require JWT authentication
router.use(authenticateToken);

// Validate coupon code (Admin, Staff, and Customer)
router.post('/validate', validateDiscount);

// List discounts (Admin, Staff)
router.get('/', authorizeRoles('admin', 'staff'), getDiscounts);

// Get single discount details (Admin, Staff)
router.get('/:id', authorizeRoles('admin', 'staff'), getDiscountById);

// Create discount (Admin, Staff)
router.post('/', authorizeRoles('admin', 'staff'), createDiscount);

// Update discount (Admin, Staff)
router.put('/:id', authorizeRoles('admin', 'staff'), updateDiscount);

// Deactivate discount (Admin, Staff)
router.delete('/:id', authorizeRoles('admin', 'staff'), deleteDiscount);

module.exports = router;
