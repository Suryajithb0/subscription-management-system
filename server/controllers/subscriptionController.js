const Subscription = require('../models/Subscription');
const Customer = require('../models/Customer');
const Plan = require('../models/Plan');

// Valid status transitions map
const VALID_TRANSITIONS = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'cancelled', 'expired'],
  paused: ['active', 'cancelled', 'expired'],
  cancelled: [], // terminal state
  expired: [],   // terminal state
};

// GET /api/subscriptions
const getSubscriptions = async (req, res, next) => {
  try {
    const { search, status, customer_id, page, limit } = req.query;

    // RBAC: Customer users only access their own subscriptions
    let scopedUserId = null;
    if (req.user.role === 'customer') {
      scopedUserId = req.user.id;
    }

    const result = await Subscription.findAll({
      search,
      status,
      customer_id,
      userId: scopedUserId,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscriptions retrieved successfully.',
      data: result.subscriptions,
      metrics: result.metrics,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/subscriptions/:id
const getSubscriptionById = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: `Subscription with ID ${subscriptionId} not found.`,
      });
    }

    // Role ownership check: Customers cannot view another customer's subscription
    if (req.user.role === 'customer') {
      if (subscription.customer_user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this subscription.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/subscriptions
const createSubscription = async (req, res, next) => {
  try {
    const {
      customer_id,
      plan_id,
      quantity,
      start_date,
      end_date,
      auto_renew,
      notes,
      status,
    } = req.body;

    // 1. Validate customer exists
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required.',
      });
    }

    const customer = await Customer.findById(customer_id);
    if (!customer) {
      return res.status(400).json({
        success: false,
        message: `Customer with ID ${customer_id} does not exist.`,
      });
    }

    // 2. Validate plan exists and is active
    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required.',
      });
    }

    const plan = await Plan.findById(plan_id);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: `Plan with ID ${plan_id} does not exist.`,
      });
    }

    if (!plan.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Inactive plans cannot be selected for new subscriptions.',
      });
    }

    // 3. Validate Quantity (Respect minimum quantity constraint)
    const parsedQty = parseInt(quantity !== undefined ? quantity : 1, 10);
    const minQty = plan.minimum_quantity || 1;

    if (isNaN(parsedQty) || parsedQty < minQty) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be at least ${minQty} as required by this plan.`,
      });
    }

    // 4. Validate Dates
    if (!start_date) {
      return res.status(400).json({
        success: false,
        message: 'Subscription start date is required.',
      });
    }

    if (isNaN(Date.parse(start_date))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start date format.',
      });
    }

    if (end_date) {
      if (isNaN(Date.parse(end_date))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format.',
        });
      }
      if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be strictly after the start date.',
        });
      }
    }

    // 5. Authoritative backend calculation (Never trust frontend totals)
    const unitPrice = parseFloat(plan.price) || 0;
    const totalAmount = Number((unitPrice * parsedQty).toFixed(2));
    const nextBillingDate = Subscription.calculateNextBillingDate(start_date, plan.billing_cycle);
    const initialStatus = status === 'active' ? 'active' : 'draft';

    const newSubscriptionId = await Subscription.create({
      customer_id: customer.id,
      plan_id: plan.id,
      quantity: parsedQty,
      start_date,
      end_date: end_date || null,
      auto_renew: auto_renew !== undefined ? Boolean(auto_renew) : true,
      notes,
      status: initialStatus,
      unit_price: unitPrice,
      total_amount: totalAmount,
      billing_cycle: plan.billing_cycle,
      next_billing_date: nextBillingDate,
    });

    const newSub = await Subscription.findById(newSubscriptionId);

    return res.status(201).json({
      success: true,
      message: `Subscription created successfully in ${initialStatus} status.`,
      data: newSub,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/subscriptions/:id
const updateSubscription = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const existing = await Subscription.findById(subscriptionId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Subscription with ID ${subscriptionId} not found.`,
      });
    }

    if (existing.status === 'cancelled' || existing.status === 'expired') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify a subscription in ${existing.status} status.`,
      });
    }

    const { quantity, end_date, auto_renew, notes } = req.body;

    let parsedQty = existing.quantity;
    let unitPrice = existing.unit_price;
    let totalAmount = existing.total_amount;

    if (quantity !== undefined) {
      parsedQty = parseInt(quantity, 10);
      if (isNaN(parsedQty) || parsedQty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1.',
        });
      }
      totalAmount = Number((unitPrice * parsedQty).toFixed(2));
    }

    if (end_date !== undefined && end_date !== null && end_date !== '') {
      if (new Date(end_date) <= new Date(existing.start_date)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be strictly after the start date.',
        });
      }
    }

    await Subscription.update(subscriptionId, {
      quantity: parsedQty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      end_date: end_date !== undefined ? end_date : existing.end_date,
      auto_renew: auto_renew !== undefined ? Boolean(auto_renew) : existing.auto_renew,
      notes: notes !== undefined ? notes : existing.notes,
    });

    const updated = await Subscription.findById(subscriptionId);

    return res.status(200).json({
      success: true,
      message: 'Subscription updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/subscriptions/:id/status
const patchSubscriptionStatus = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const existing = await Subscription.findById(subscriptionId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Subscription with ID ${subscriptionId} not found.`,
      });
    }

    const { action, status, cancel_reason } = req.body;
    const targetStatus = status || action;

    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        message: 'Target status or action is required (activate, pause, resume, cancel, renew).',
      });
    }

    const currentStatus = existing.status;

    // Handle lifecycle actions:
    // 1. ACTIVATE
    if (targetStatus === 'active' || targetStatus === 'activate') {
      if (currentStatus === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Subscription is already active.',
        });
      }
      if (currentStatus !== 'draft' && currentStatus !== 'paused') {
        return res.status(400).json({
          success: false,
          message: `Cannot activate a subscription from ${currentStatus} state.`,
        });
      }
      await Subscription.setStatus(subscriptionId, 'active');
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: 'Subscription activated successfully.',
        data: updated,
      });
    }

    // 2. PAUSE
    if (targetStatus === 'paused' || targetStatus === 'pause') {
      if (currentStatus !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Cannot pause a subscription that is currently ${currentStatus}.`,
        });
      }
      if (!existing.allow_pause) {
        return res.status(400).json({
          success: false,
          message: 'The subscription plan policy does not permit pausing.',
        });
      }
      await Subscription.setStatus(subscriptionId, 'paused');
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: 'Subscription paused successfully.',
        data: updated,
      });
    }

    // 3. RESUME
    if (targetStatus === 'resume') {
      if (currentStatus !== 'paused') {
        return res.status(400).json({
          success: false,
          message: `Cannot resume a subscription that is not currently paused (status: ${currentStatus}).`,
        });
      }
      await Subscription.setStatus(subscriptionId, 'active');
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: 'Subscription resumed successfully.',
        data: updated,
      });
    }

    // 4. CANCEL
    if (targetStatus === 'cancelled' || targetStatus === 'cancel') {
      if (currentStatus === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Subscription is already cancelled.',
        });
      }
      if (currentStatus === 'expired') {
        return res.status(400).json({
          success: false,
          message: 'Expired subscriptions cannot be cancelled.',
        });
      }
      await Subscription.setStatus(subscriptionId, 'cancelled', cancel_reason);
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully.',
        data: updated,
      });
    }

    // 5. RENEW
    if (targetStatus === 'renew') {
      if (currentStatus === 'cancelled' || currentStatus === 'expired') {
        return res.status(400).json({
          success: false,
          message: `Cannot renew a subscription in ${currentStatus} status.`,
        });
      }
      if (!existing.allow_renewal) {
        return res.status(400).json({
          success: false,
          message: 'The plan policy strictly disallows renewal.',
        });
      }

      // Calculate next billing date forward from current next_billing_date
      const currentNextDate = existing.next_billing_date || existing.start_date || new Date().toISOString().substring(0, 10);
      const newNextDate = Subscription.calculateNextBillingDate(currentNextDate, existing.billing_cycle);

      await Subscription.renew(subscriptionId, newNextDate);
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: `Subscription successfully renewed through ${newNextDate}.`,
        data: updated,
      });
    }

    // 6. EXPIRE
    if (targetStatus === 'expired') {
      await Subscription.setStatus(subscriptionId, 'expired');
      const updated = await Subscription.findById(subscriptionId);
      return res.status(200).json({
        success: true,
        message: 'Subscription marked as expired.',
        data: updated,
      });
    }

    return res.status(400).json({
      success: false,
      message: `Unknown or unsupported status transition: ${targetStatus}`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/subscriptions/:id/invoices
const getSubscriptionInvoices = async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: `Subscription with ID ${subscriptionId} not found.`,
      });
    }

    // Return empty list safely for Stage 08 (Invoices module is upcoming)
    return res.status(200).json({
      success: true,
      data: [],
      message: 'No invoices currently generated for this subscription cycle.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  patchSubscriptionStatus,
  getSubscriptionInvoices,
};
