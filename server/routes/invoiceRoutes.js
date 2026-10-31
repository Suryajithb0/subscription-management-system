const express = require('express');
const router = express.Router();
const {
  getInvoices,
  getInvoiceById,
  createInvoice,
  createFromSubscription,
  updateInvoice,
  patchInvoiceStatus,
  getInvoicePrintData,
  triggerBilling,
  getTaxes
} = require('../controllers/invoiceController');
const { getInvoicePayments } = require('../controllers/paymentController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All invoice endpoints require JWT authentication
router.use(authenticateToken);

// Read tax records for item selection
router.get('/taxes', getTaxes);

// Admin / Staff trigger for recurring billing
router.post('/trigger-billing', authorizeRoles('admin', 'staff'), triggerBilling);

// List invoices (Admin, Staff, and Customer with ownership filtering)
router.get('/', getInvoices);

// Create manual invoice (Admin & Staff)
router.post('/', authorizeRoles('admin', 'staff'), createInvoice);

// Generate invoice from active subscription (Admin & Staff)
router.post('/from-subscription/:subscriptionId', authorizeRoles('admin', 'staff'), createFromSubscription);

// Print layout data (Admin, Staff, Customer with ownership check)
router.get('/:id/print', getInvoicePrintData);

// Single invoice details (Admin, Staff, Customer with ownership check)
router.get('/:id', getInvoiceById);

// Payments recorded for an invoice (Admin, Staff, Customer with ownership check)
router.get('/:id/payments', getInvoicePayments);

// Update eligible draft/pending invoice (Admin & Staff)
router.put('/:id', authorizeRoles('admin', 'staff'), updateInvoice);

// Update invoice status (Admin & Staff)
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchInvoiceStatus);

module.exports = router;
