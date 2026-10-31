const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  patchCustomerStatus,
  deleteCustomer,
} = require('../controllers/customerController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All customer routes require authentication
router.use(authenticateToken);

// Read endpoints: Admin, Staff, and Customer (Customer can only see own profile via controller ownership check)
router.get('/', getCustomers);
router.get('/:id', getCustomerById);

// Admin & Staff only for administrative creation & modifications
router.post('/', authorizeRoles('admin', 'staff'), createCustomer);
router.put('/:id', authorizeRoles('admin', 'staff'), updateCustomer);
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchCustomerStatus);
router.delete('/:id', authorizeRoles('admin', 'staff'), deleteCustomer);

module.exports = router;
