const Plan = require('../models/Plan');
const Product = require('../models/Product');

const ALLOWED_BILLING_CYCLES = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

// Helper validator for ISO / date strings
const isValidDateString = (dateStr) => {
  if (!dateStr) return true; // optional
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
};

// GET /api/plans
const getPlans = async (req, res, next) => {
  try {
    const { search, product_id, billing_cycle, status, page, limit } = req.query;

    const result = await Plan.findAll({
      search,
      product_id,
      billing_cycle,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription plans retrieved successfully.',
      data: result.plans,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/plans/:id
const getPlanById = async (req, res, next) => {
  try {
    const planId = req.params.id;
    const plan = await Plan.findById(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID ${planId} not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/plans
const createPlan = async (req, res, next) => {
  try {
    const {
      product_id,
      name,
      description,
      price,
      billing_cycle,
      minimum_quantity,
      available_from,
      available_until,
      auto_close,
      allow_pause,
      allow_early_close,
      allow_renewal,
      is_active,
    } = req.body;

    // 1. Validate Product Exists
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product selection is required.',
      });
    }

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(400).json({
        success: false,
        message: `Selected product ID ${product_id} does not exist.`,
      });
    }

    // 2. Validate Name
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Plan name is required.',
      });
    }

    // 3. Validate Price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number.',
      });
    }

    // 4. Validate Billing Cycle
    if (!billing_cycle || !ALLOWED_BILLING_CYCLES.includes(billing_cycle)) {
      return res.status(400).json({
        success: false,
        message: `Billing cycle must be one of: ${ALLOWED_BILLING_CYCLES.join(', ')}.`,
      });
    }

    // 5. Validate Minimum Quantity
    const parsedMinQty = parseInt(minimum_quantity !== undefined ? minimum_quantity : 1, 10);
    if (isNaN(parsedMinQty) || parsedMinQty < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum quantity must be at least 1.',
      });
    }

    // 6. Validate Availability Dates
    if (available_from && !isValidDateString(available_from)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid "available_from" date format.',
      });
    }

    if (available_until && !isValidDateString(available_until)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid "available_until" date format.',
      });
    }

    if (available_from && available_until) {
      const fromTime = new Date(available_from).getTime();
      const untilTime = new Date(available_until).getTime();
      if (fromTime > untilTime) {
        return res.status(400).json({
          success: false,
          message: '"available_until" date must be equal to or after "available_from" date.',
        });
      }
    }

    const planId = await Plan.create({
      product_id: product.id,
      name,
      description,
      price: parsedPrice,
      billing_cycle,
      minimum_quantity: parsedMinQty,
      available_from: available_from || null,
      available_until: available_until || null,
      auto_close: Boolean(auto_close),
      allow_pause: allow_pause !== undefined ? Boolean(allow_pause) : true,
      allow_early_close: allow_early_close !== undefined ? Boolean(allow_early_close) : true,
      allow_renewal: allow_renewal !== undefined ? Boolean(allow_renewal) : true,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
    });

    const newPlan = await Plan.findById(planId);

    return res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully.',
      data: newPlan,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/plans/:id
const updatePlan = async (req, res, next) => {
  try {
    const planId = req.params.id;
    const existing = await Plan.findById(planId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID ${planId} not found.`,
      });
    }

    const {
      product_id,
      name,
      description,
      price,
      billing_cycle,
      minimum_quantity,
      available_from,
      available_until,
      auto_close,
      allow_pause,
      allow_early_close,
      allow_renewal,
      is_active,
    } = req.body;

    const targetProductId = product_id !== undefined ? product_id : existing.product_id;
    const product = await Product.findById(targetProductId);
    if (!product) {
      return res.status(400).json({
        success: false,
        message: `Product ID ${targetProductId} does not exist.`,
      });
    }

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Plan name cannot be empty.',
      });
    }

    let parsedPrice = existing.price;
    if (price !== undefined) {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid non-negative number.',
        });
      }
    }

    const cycle = billing_cycle !== undefined ? billing_cycle : existing.billing_cycle;
    if (!ALLOWED_BILLING_CYCLES.includes(cycle)) {
      return res.status(400).json({
        success: false,
        message: `Billing cycle must be one of: ${ALLOWED_BILLING_CYCLES.join(', ')}.`,
      });
    }

    let parsedMinQty = existing.minimum_quantity;
    if (minimum_quantity !== undefined) {
      parsedMinQty = parseInt(minimum_quantity, 10);
      if (isNaN(parsedMinQty) || parsedMinQty < 1) {
        return res.status(400).json({
          success: false,
          message: 'Minimum quantity must be at least 1.',
        });
      }
    }

    const fromDate = available_from !== undefined ? available_from : existing.available_from;
    const untilDate = available_until !== undefined ? available_until : existing.available_until;

    if (fromDate && untilDate) {
      const fromTime = new Date(fromDate).getTime();
      const untilTime = new Date(untilDate).getTime();
      if (fromTime > untilTime) {
        return res.status(400).json({
          success: false,
          message: '"available_until" date must be equal to or after "available_from" date.',
        });
      }
    }

    await Plan.update(planId, {
      product_id: targetProductId,
      name: name !== undefined ? name : existing.name,
      description: description !== undefined ? description : existing.description,
      price: parsedPrice,
      billing_cycle: cycle,
      minimum_quantity: parsedMinQty,
      available_from: fromDate || null,
      available_until: untilDate || null,
      auto_close: auto_close !== undefined ? Boolean(auto_close) : existing.auto_close,
      allow_pause: allow_pause !== undefined ? Boolean(allow_pause) : existing.allow_pause,
      allow_early_close: allow_early_close !== undefined ? Boolean(allow_early_close) : existing.allow_early_close,
      allow_renewal: allow_renewal !== undefined ? Boolean(allow_renewal) : existing.allow_renewal,
      is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
    });

    const updated = await Plan.findById(planId);

    return res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/plans/:id/status
const patchPlanStatus = async (req, res, next) => {
  try {
    const planId = req.params.id;
    const existing = await Plan.findById(planId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID ${planId} not found.`,
      });
    }

    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Field "is_active" (boolean) is required.',
      });
    }

    await Plan.setStatus(planId, Boolean(is_active));

    return res.status(200).json({
      success: true,
      message: `Plan ${is_active ? 'activated' : 'deactivated'} successfully.`,
      data: {
        id: Number(planId),
        is_active: Boolean(is_active),
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plans/:id
const deletePlan = async (req, res, next) => {
  try {
    const planId = req.params.id;
    const existing = await Plan.findById(planId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Plan with ID ${planId} not found.`,
      });
    }

    // Check for existing subscriptions
    const hasSubscriptions = await Plan.hasReferences(planId);

    if (hasSubscriptions) {
      // Safe deactivation preferred over permanent deletion
      await Plan.setStatus(planId, false);
      return res.status(200).json({
        success: true,
        action: 'deactivated',
        message: 'Plan has associated subscriptions and was deactivated rather than permanently deleted.',
        data: { id: Number(planId), is_active: false },
      });
    }

    // Safe to delete permanently
    await Plan.delete(planId);

    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: 'Subscription plan permanently deleted.',
      data: { id: Number(planId) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  patchPlanStatus,
  deletePlan,
};
