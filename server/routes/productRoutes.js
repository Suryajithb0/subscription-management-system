const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  patchProductStatus,
  deleteProduct,
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} = require('../controllers/productController');

const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Public or Authenticated read operations
// All logged in users (including customer) can view products, but write/update/delete is restricted
router.use(authenticateToken);

// PART 1: Product Endpoints
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin & Staff only for management operations
router.post('/', authorizeRoles('admin', 'staff'), createProduct);
router.put('/:id', authorizeRoles('admin', 'staff'), updateProduct);
router.patch('/:id/status', authorizeRoles('admin', 'staff'), patchProductStatus);
router.delete('/:id', authorizeRoles('admin', 'staff'), deleteProduct);

// PART 2: Product Variant Endpoints
router.get('/:id/variants', getVariants);
router.post('/:id/variants', authorizeRoles('admin', 'staff'), createVariant);
router.put('/:id/variants/:variantId', authorizeRoles('admin', 'staff'), updateVariant);
router.delete('/:id/variants/:variantId', authorizeRoles('admin', 'staff'), deleteVariant);

module.exports = router;
