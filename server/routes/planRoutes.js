const express = require('express');
const router = express.Router();
const {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  patchPlanStatus,
  deletePlan,
} = require('../controllers/planController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// All plan routes require authentication
router.use(authenticateToken);

// Read endpoints accessible to all authenticated users (Admin, Staff, Customer)
router.get('/', getPlans);
router.get('/:id', getPlanById);

// Administrative mutation endpoints (Admin and Staff only)
router.post('/', authorizeRoles('admin', 'staff'), createPlan);
router.put('/:id', authorizeRoles('admin', 'staff'), updatePlan);
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchPlanStatus);
router.delete('/:id', authorizeRoles('admin', 'staff'), deletePlan);

module.exports = router;
