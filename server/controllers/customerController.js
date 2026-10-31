const Customer = require('../models/Customer');
const { validateEmail } = require('../utils/passwordValidation');

// Simple phone validation helper (allows digits, spaces, hyphens, plus)
const isValidPhone = (phone) => {
  if (!phone) return true; // optional
  const phoneRegex = /^[\d\s+\-()]{7,25}$/;
  return phoneRegex.test(phone.trim());
};

// GET /api/customers
const getCustomers = async (req, res, next) => {
  try {
    // If customer role, only allow viewing own customer record
    if (req.user.role === 'customer') {
      const ownCustomer = await Customer.findByUserId(req.user.id);
      return res.status(200).json({
        success: true,
        data: ownCustomer ? [ownCustomer] : [],
        metrics: { total: ownCustomer ? 1 : 0, active: ownCustomer?.status === 'active' ? 1 : 0, new30Days: 0 },
        pagination: { page: 1, limit: 10, total: ownCustomer ? 1 : 0, totalPages: 1 },
      });
    }

    const { search, status, page, limit, sort, order } = req.query;

    const result = await Customer.findAll({
      search,
      status,
      page,
      limit,
      sort,
      order,
    });

    return res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully.',
      data: result.customers,
      metrics: result.metrics,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/customers/:id
const getCustomerById = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found.`,
      });
    }

    // Role check: Customer role cannot view another customer's profile
    if (req.user.role === 'customer') {
      if (customer.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view another customer\'s profile.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/customers
const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, company_name, address } = req.body;

    // 1. Validate Name
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer full name is required.',
      });
    }

    // 2. Validate Email
    if (!email || !validateEmail(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    // 3. Prevent Duplicate Email
    const existing = await Customer.findByEmail(email.trim());
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A customer with this email address already exists.',
      });
    }

    // 4. Validate Phone
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (at least 7 digits).',
      });
    }

    const customerId = await Customer.create({
      name,
      email,
      phone,
      company_name,
      address,
    });

    const newCustomer = await Customer.findById(customerId);

    return res.status(201).json({
      success: true,
      message: 'Customer record created successfully.',
      data: newCustomer,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/customers/:id
const updateCustomer = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const existing = await Customer.findById(customerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found.`,
      });
    }

    const { name, email, phone, company_name, address, status } = req.body;

    // Validate Name if present
    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Customer name cannot be empty.',
      });
    }

    // Validate Email if changing
    const targetEmail = email !== undefined ? email.trim() : existing.email;
    if (!validateEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    // Check duplicate email
    if (email && email.toLowerCase().trim() !== existing.email.toLowerCase()) {
      const emailConflict = await Customer.findByEmail(email.trim(), customerId);
      if (emailConflict) {
        return res.status(409).json({
          success: false,
          message: 'Another customer is already registered with this email address.',
        });
      }
    }

    // Validate Phone
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number.',
      });
    }

    await Customer.update(customerId, {
      name: name !== undefined ? name : existing.name,
      email: targetEmail,
      phone: phone !== undefined ? phone : existing.phone,
      company_name: company_name !== undefined ? company_name : existing.company_name,
      address: address !== undefined ? address : existing.address,
      status: status !== undefined ? status : existing.status,
    });

    const updated = await Customer.findById(customerId);

    return res.status(200).json({
      success: true,
      message: 'Customer information updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/customers/:id/status
const patchCustomerStatus = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const existing = await Customer.findById(customerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found.`,
      });
    }

    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'archived'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}.`,
      });
    }

    await Customer.setStatus(customerId, status);

    return res.status(200).json({
      success: true,
      message: `Customer status updated to ${status}.`,
      data: { id: Number(customerId), status },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res, next) => {
  try {
    const customerId = req.params.id;
    const existing = await Customer.findById(customerId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customerId} not found.`,
      });
    }

    // Check financial / subscription history
    const hasHistory = await Customer.hasReferences(customerId);

    if (hasHistory) {
      // Safe deactivation / archival
      await Customer.setStatus(customerId, 'archived');
      return res.status(200).json({
        success: true,
        action: 'archived',
        message: 'Customer has historical subscriptions or invoices and was safely archived rather than deleted.',
        data: { id: Number(customerId), status: 'archived' },
      });
    }

    await Customer.delete(customerId);

    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: 'Customer record deleted successfully.',
      data: { id: Number(customerId) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  patchCustomerStatus,
  deleteCustomer,
};
