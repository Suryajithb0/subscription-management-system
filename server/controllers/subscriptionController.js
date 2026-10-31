const Subscription = require('../models/Subscription');

// Get all subscriptions for authenticated user
const getSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.findAllByUserId(req.user.id);
    res.status(200).json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    next(error);
  }
};

// Get single subscription
const getSubscriptionById = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByIdAndUser(req.params.id, req.user.id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    next(error);
  }
};

// Create subscription
const createSubscription = async (req, res, next) => {
  try {
    const { service_name, category, cost, currency, billing_cycle, start_date, next_renewal_date, payment_method } = req.body;

    if (!service_name || !cost || !start_date || !next_renewal_date) {
      return res.status(400).json({
        success: false,
        message: 'service_name, cost, start_date, and next_renewal_date are required fields.'
      });
    }

    const newId = await Subscription.create({
      userId: req.user.id,
      serviceName: service_name,
      category,
      cost,
      currency,
      billingCycle: billing_cycle,
      startDate: start_date,
      nextRenewalDate: next_renewal_date,
      paymentMethod: payment_method
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully.',
      data: { id: newId }
    });
  } catch (error) {
    next(error);
  }
};

// Update subscription
const updateSubscription = async (req, res, next) => {
  try {
    const updated = await Subscription.update(req.params.id, req.user.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found or no changes made.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// Delete subscription
const deleteSubscription = async (req, res, next) => {
  try {
    const deleted = await Subscription.delete(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription deleted successfully.'
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
  deleteSubscription
};
