const express = require('express');
const router = express.Router();
const {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription
} = require('../controllers/subscriptionController');
const { verifyToken } = require('../middleware/authMiddleware');

// All subscription routes require authentication
router.use(verifyToken);

router.get('/', getSubscriptions);
router.get('/:id', getSubscriptionById);
router.post('/', createSubscription);
router.put('/:id', updateSubscription);
router.delete('/:id', deleteSubscription);

module.exports = router;
