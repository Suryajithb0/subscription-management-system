const Discount = require('../models/Discount');

/**
 * GET /api/discounts
 * List discounts with search, filters, pagination, and metrics
 */
const getDiscounts = async (req, res, next) => {
  try {
    const { search, type, status, page, limit } = req.query;

    const result = await Discount.findAll({
      search,
      type,
      status,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      message: 'Discounts retrieved successfully.',
      data: result.discounts,
      metrics: result.metrics,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discounts/:id
 * Retrieve single discount details and usage history
 */
const getDiscountById = async (req, res, next) => {
  try {
    const discountId = req.params.id;
    const discount = await Discount.findById(discountId);

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: `Discount with ID ${discountId} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: discount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/discounts
 * Create a new promotional discount coupon
 */
const createDiscount = async (req, res, next) => {
  try {
    const {
      name,
      code,
      description,
      type,
      value,
      min_purchase_amount,
      max_discount_amount,
      start_date,
      end_date,
      expiry_date,
      usage_limit,
      per_customer_limit,
      is_active
    } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required.'
      });
    }

    if (value === undefined || parseFloat(value) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount value must be greater than zero.'
      });
    }

    const discountId = await Discount.create({
      name,
      code,
      description,
      type,
      value: parseFloat(value),
      min_purchase_amount: min_purchase_amount ? parseFloat(min_purchase_amount) : 0,
      max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
      start_date,
      end_date,
      expiry_date,
      usage_limit: usage_limit ? parseInt(usage_limit, 10) : null,
      per_customer_limit: per_customer_limit ? parseInt(per_customer_limit, 10) : 1,
      is_active: is_active !== undefined ? Boolean(is_active) : true
    });

    const newDiscount = await Discount.findById(discountId);

    return res.status(201).json({
      success: true,
      message: 'Discount created successfully.',
      data: newDiscount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/discounts/:id
 * Update an existing discount
 */
const updateDiscount = async (req, res, next) => {
  try {
    const discountId = req.params.id;
    const existing = await Discount.findById(discountId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Discount with ID ${discountId} not found.`
      });
    }

    await Discount.update(discountId, req.body);
    const updated = await Discount.findById(discountId);

    return res.status(200).json({
      success: true,
      message: 'Discount updated successfully.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/discounts/:id
 * Deactivate / archive discount
 */
const deleteDiscount = async (req, res, next) => {
  try {
    const discountId = req.params.id;
    const existing = await Discount.findById(discountId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Discount with ID ${discountId} not found.`
      });
    }

    await Discount.delete(discountId);

    return res.status(200).json({
      success: true,
      message: `Discount '${existing.code}' has been deactivated.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/discounts/validate
 * Validate coupon code against purchase or invoice amount
 */
const validateDiscount = async (req, res, next) => {
  try {
    const { code, customer_id, amount, invoice_id } = req.body;

    const result = await Discount.validateCoupon({
      code,
      customer_id,
      amount,
      invoice_id
    });

    return res.status(200).json({
      success: true,
      message: `Coupon code '${result.code}' applied successfully!`,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscount
};
