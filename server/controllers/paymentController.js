const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');

/**
 * GET /api/payments
 * List payments with pagination, search, status, and method filters
 */
const getPayments = async (req, res, next) => {
  try {
    const { search, status, payment_method, customer_id, invoice_id, page, limit } = req.query;

    // RBAC: Customer users only access their own payments
    let scopedUserId = null;
    if (req.user.role === 'customer') {
      scopedUserId = req.user.id;
    }

    const result = await Payment.findAll({
      search,
      status,
      payment_method,
      customer_id,
      invoice_id,
      userId: scopedUserId,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Payments retrieved successfully.',
      data: result.payments,
      metrics: result.metrics,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/:id
 * Retrieve single payment details
 */
const getPaymentById = async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: `Payment with ID ${paymentId} not found.`
      });
    }

    // Role ownership check: Customers cannot access another customer's payment
    if (req.user.role === 'customer' && payment.customer_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this payment.'
      });
    }

    return res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments
 * Record a payment against an invoice
 */
const recordPayment = async (req, res, next) => {
  try {
    const {
      invoice_id,
      customer_id,
      amount,
      payment_method,
      transaction_reference,
      payment_date,
      status = 'completed',
      notes
    } = req.body;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'Invoice ID is required.'
      });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero.'
      });
    }

    if (!payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required.'
      });
    }

    const paymentId = await Payment.create({
      invoice_id: parseInt(invoice_id, 10),
      customer_id: customer_id ? parseInt(customer_id, 10) : null,
      amount: parseFloat(amount),
      payment_method,
      transaction_reference,
      payment_date,
      status,
      notes
    });

    const createdPayment = await Payment.findById(paymentId);
    const updatedInvoice = await Invoice.findById(invoice_id);

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: {
        payment: createdPayment,
        invoice: updatedInvoice
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/payments/:id/status
 * Update payment status (completed, failed, refunded)
 */
const patchPaymentStatus = async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    await Payment.updateStatus(paymentId, status);
    const updatedPayment = await Payment.findById(paymentId);

    return res.status(200).json({
      success: true,
      message: `Payment status updated to '${status}'.`,
      data: updatedPayment
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/:id/payments
 * Retrieve all payments for an invoice
 */
const getInvoicePayments = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID ${invoiceId} not found.`
      });
    }

    // Role check for customer
    if (req.user.role === 'customer' && invoice.customer_user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view payments for this invoice.'
      });
    }

    const payments = await Payment.findByInvoiceId(invoiceId);

    return res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  recordPayment,
  patchPaymentStatus,
  getInvoicePayments
};
