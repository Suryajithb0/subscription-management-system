const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');

/**
 * Controller for Products and Product Variants
 */

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const { search, product_type, status, page, limit } = req.query;

    const result = await Product.findAll({
      search,
      product_type,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully.',
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    // Include variants
    const variants = await ProductVariant.findByProductId(productId);

    return res.status(200).json({
      success: true,
      data: {
        ...product,
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { name, description, product_type, sales_price, cost_price, notes, is_active } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Product name is required.',
      });
    }

    const parsedSalesPrice = parseFloat(sales_price);
    const parsedCostPrice = parseFloat(cost_price || 0);

    if (isNaN(parsedSalesPrice) || parsedSalesPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Sales price must be a valid non-negative number.',
      });
    }

    if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Cost price must be a valid non-negative number.',
      });
    }

    const productId = await Product.create({
      name,
      description,
      product_type: product_type || 'digital',
      sales_price: parsedSalesPrice,
      cost_price: parsedCostPrice,
      notes,
      is_active: is_active !== undefined ? is_active : true,
    });

    const newProduct = await Product.findById(productId);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: newProduct,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const existing = await Product.findById(productId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    const { name, description, product_type, sales_price, cost_price, notes, is_active } = req.body;

    if (name !== undefined && name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Product name cannot be empty.',
      });
    }

    let parsedSalesPrice = existing.sales_price;
    if (sales_price !== undefined) {
      parsedSalesPrice = parseFloat(sales_price);
      if (isNaN(parsedSalesPrice) || parsedSalesPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Sales price must be a valid non-negative number.',
        });
      }
    }

    let parsedCostPrice = existing.cost_price;
    if (cost_price !== undefined) {
      parsedCostPrice = parseFloat(cost_price);
      if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cost price must be a valid non-negative number.',
        });
      }
    }

    await Product.update(productId, {
      name: name !== undefined ? name : existing.name,
      description: description !== undefined ? description : existing.description,
      product_type: product_type !== undefined ? product_type : existing.product_type,
      sales_price: parsedSalesPrice,
      cost_price: parsedCostPrice,
      notes: notes !== undefined ? notes : existing.notes,
      is_active: is_active !== undefined ? is_active : existing.is_active,
    });

    const updated = await Product.findById(productId);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id/status
const patchProductStatus = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const existing = await Product.findById(productId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Field "is_active" (boolean) is required.',
      });
    }

    await Product.setStatus(productId, Boolean(is_active));

    return res.status(200).json({
      success: true,
      message: `Product ${is_active ? 'activated' : 'deactivated'} successfully.`,
      data: {
        id: Number(productId),
        is_active: Boolean(is_active),
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const existing = await Product.findById(productId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    // Check if product has historical dependencies
    const hasHistory = await Product.hasReferences(productId);

    if (hasHistory) {
      // Safe deactivation preferred over breaking relations
      await Product.setStatus(productId, false);
      return res.status(200).json({
        success: true,
        action: 'deactivated',
        message: 'Product has historical subscriptions/plans and was deactivated rather than deleted to protect database integrity.',
        data: { id: Number(productId), is_active: false },
      });
    }

    // Safe to delete permanently
    await Product.delete(productId);

    return res.status(200).json({
      success: true,
      action: 'deleted',
      message: 'Product and associated variants deleted successfully.',
      data: { id: Number(productId) },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PART 2: PRODUCT VARIANTS HANDLERS
// ==========================================

// GET /api/products/:id/variants
const getVariants = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    const variants = await ProductVariant.findByProductId(productId);

    // Calculate final effective price for each variant
    const formattedVariants = variants.map((v) => ({
      ...v,
      final_price: Number((product.sales_price + v.additional_price).toFixed(2)),
    }));

    return res.status(200).json({
      success: true,
      data: formattedVariants,
      base_product: {
        id: product.id,
        name: product.name,
        sales_price: product.sales_price,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/products/:id/variants
const createVariant = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    const { variant_name, variant_value, additional_price, is_active } = req.body;

    if (!variant_name || variant_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Variant name (e.g. Brand, Tier, License) is required.',
      });
    }

    if (!variant_value || variant_value.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Variant value (e.g. Odoo, Zoho, Enterprise) is required.',
      });
    }

    const parsedPrice = parseFloat(additional_price || 0);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Additional price must be a valid non-negative number.',
      });
    }

    const variantId = await ProductVariant.create({
      productId,
      variant_name,
      variant_value,
      additional_price: parsedPrice,
      is_active: is_active !== undefined ? is_active : true,
    });

    const newVariant = await ProductVariant.findById(variantId, productId);

    return res.status(201).json({
      success: true,
      message: 'Product variant created successfully.',
      data: {
        ...newVariant,
        final_price: Number((product.sales_price + newVariant.additional_price).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/products/:id/variants/:variantId
const updateVariant = async (req, res, next) => {
  try {
    const { id: productId, variantId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${productId} not found.`,
      });
    }

    const existingVariant = await ProductVariant.findById(variantId, productId);
    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        message: `Variant with ID ${variantId} does not belong to product ${productId}.`,
      });
    }

    const { variant_name, variant_value, additional_price, is_active } = req.body;

    let parsedPrice = existingVariant.additional_price;
    if (additional_price !== undefined) {
      parsedPrice = parseFloat(additional_price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Additional price must be a valid non-negative number.',
        });
      }
    }

    await ProductVariant.update(variantId, productId, {
      variant_name: variant_name !== undefined ? variant_name : existingVariant.variant_name,
      variant_value: variant_value !== undefined ? variant_value : existingVariant.variant_value,
      additional_price: parsedPrice,
      is_active: is_active !== undefined ? is_active : existingVariant.is_active,
    });

    const updated = await ProductVariant.findById(variantId, productId);

    return res.status(200).json({
      success: true,
      message: 'Product variant updated successfully.',
      data: {
        ...updated,
        final_price: Number((product.sales_price + updated.additional_price).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/products/:id/variants/:variantId
const deleteVariant = async (req, res, next) => {
  try {
    const { id: productId, variantId } = req.params;

    const existingVariant = await ProductVariant.findById(variantId, productId);
    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        message: `Variant with ID ${variantId} does not belong to product ${productId}.`,
      });
    }

    await ProductVariant.delete(variantId, productId);

    return res.status(200).json({
      success: true,
      message: 'Product variant deleted successfully.',
      data: { id: Number(variantId), product_id: Number(productId) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
