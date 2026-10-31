/**
 * Role-Based Access Control (RBAC) Middleware
 * Defines access restrictions for ADMIN, STAFF, and CUSTOMER roles.
 */

/**
 * Authorize specified roles
 * Usage: authorizeRoles('admin') or authorizeRoles('admin', 'staff')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to authorization.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};

/**
 * Enforces customer resource ownership
 * Admin and Staff have supervisory access.
 * Customer role can only access resources matching their own customer/user ID.
 * 
 * @param {Function} getOwnerId Callback returning the resource owner user_id from req
 */
const checkCustomerOwnership = (getOwnerId) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admins and Staff can view customer records within operational duties
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      return next();
    }

    // Customer role: strictly check ownership
    const resourceOwnerId = typeof getOwnerId === 'function' 
      ? getOwnerId(req) 
      : (req.params.userId || req.params.customerId || req.params.id);

    if (!resourceOwnerId || Number(resourceOwnerId) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view or modify another customer\'s resources.'
      });
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
  checkCustomerOwnership
};
