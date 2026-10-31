const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { pool } = require('../config/db');
const billingScheduler = require('../services/billingScheduler');

/**
 * GET /api/invoices
 * List invoices with pagination, search, status and customer filters
 */
const getInvoices = async (req, res, next) => {
  try {
    const { search, status, customer_id, page, limit } = req.query;

    // RBAC Scoping: Customers can only view their own invoices
    let scopedUserId = null;
    if (req.user.role === 'customer') {
      scopedUserId = req.user.id;
    }

    const result = await Invoice.findAll({
      search,
      status,
      customer_id,
      userId: scopedUserId,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Invoices retrieved successfully.',
      data: result.invoices,
      metrics: result.metrics,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/:id
 * Invoice details and items
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice with ID ${invoiceId} not found.`
      });
    }

    // Role ownership check: Customers cannot view another customer's invoice
    if (req.user.role === 'customer') {
      if (invoice.customer_user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this invoice.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices
 * Create a manual invoice
 */
const createInvoice = async (req, res, next) => {
  try {
    const {
      customer_id,
      subscription_id,
      issue_date,
      due_date,
      billing_period_start,
      billing_period_end,
      billing_period,
      notes,
      status = 'draft',
      currency = 'USD',
      amount_paid = 0,
      items
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required.'
      });
    }

    if (!issue_date || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'Issue date and due date are required.'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one invoice line item is required.'
      });
    }

    const invoiceId = await Invoice.create({
      customer_id: parseInt(customer_id, 10),
      subscription_id: subscription_id ? parseInt(subscription_id, 10) : null,
      issue_date,
      due_date,
      billing_period_start,
      billing_period_end,
      billing_period,
      notes,
      status,
      currency,
      amount_paid,
      items
    });

    const newInvoice = await Invoice.findById(invoiceId);

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      data: newInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices/from-subscription/:subscriptionId
 * Generate an invoice from an active subscription
 */
const createFromSubscription = async (req, res, next) => {
  try {
    const subscriptionId = req.params.subscriptionId;
    const { issue_date, due_date, billing_period_start, billing_period_end, tax_rate } = req.body;

    const invoiceId = await Invoice.createFromSubscription(subscriptionId, {
      issue_date,
      due_date,
      billing_period_start,
      billing_period_end,
      tax_rate
    });

    const newInvoice = await Invoice.findById(invoiceId);

    return res.status(201).json({
      success: true,
      message: 'Invoice generated successfully from subscription.',
      data: newInvoice
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/invoices/:id
 * Update an eligible draft/pending invoice
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const { issue_date, due_date, billing_period, notes, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one invoice line item is required.'
      });
    }

    await Invoice.update(invoiceId, {
      issue_date,
      due_date,
      billing_period,
      notes,
      items
    });

    const updated = await Invoice.findById(invoiceId);

    return res.status(200).json({
      success: true,
      message: 'Invoice updated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/invoices/:id/status
 * Update invoice status when permitted
 */
const patchInvoiceStatus = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const { status, amount_paid } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    await Invoice.updateStatus(invoiceId, status, { amount_paid });
    const updated = await Invoice.findById(invoiceId);

    return res.status(200).json({
      success: true,
      message: `Invoice status updated to '${status}'.`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/:id/print
 * Return invoice data formatted for printing
 */
const getInvoicePrintData = async (req, res, next) => {
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
        message: 'Access denied: You are not authorized to print this invoice.'
      });
    }

    const companyInfo = {
      name: 'SubFlow Subscription Management Inc.',
      tagline: 'Modern Subscription & Recurring Billing Infrastructure',
      address: '100 Innovation Way, Suite 400',
      city: 'San Francisco, CA 94105',
      country: 'United States',
      email: 'billing@subflow.io',
      phone: '+1 (800) 555-0199',
      taxId: 'US-EIN-94-3829102'
    };

    return res.status(200).json({
      success: true,
      data: {
        company: companyInfo,
        invoice,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices/trigger-billing
 * Admin/Staff manual trigger for due subscription billing
 */
const triggerBilling = async (req, res, next) => {
  try {
    const results = await billingScheduler.runBillingCycle();

    return res.status(200).json({
      success: true,
      message: 'Automated recurring billing cycle processed successfully.',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/taxes
 * Returns active tax rates for invoice item calculation
 */
const getTaxes = async (req, res, next) => {
  try {
    const [taxes] = await pool.execute(
      'SELECT id, name, rate, type, country, state, is_compound, is_active FROM taxes WHERE is_active = 1 ORDER BY rate ASC'
    );
    const formatted = taxes.map(t => ({
      ...t,
      rate: parseFloat(t.rate)
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  createFromSubscription,
  updateInvoice,
  patchInvoiceStatus,
  getInvoicePrintData,
  triggerBilling,
  getTaxes
};
