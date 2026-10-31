const { pool } = require('../config/db');

class ProductVariant {
  /**
   * Find all variants belonging to a specific product
   */
  static async findByProductId(productId) {
    const [rows] = await pool.execute(
      `SELECT id, product_id, variant_name, variant_value, additional_price, 
              is_active, created_at, updated_at 
       FROM product_variants 
       WHERE product_id = ? 
       ORDER BY id ASC`,
      [productId]
    );
    return rows.map((r) => ({
      ...r,
      additional_price: parseFloat(r.additional_price) || 0,
    }));
  }

  /**
   * Find specific variant by id and product_id
   */
  static async findById(id, productId = null) {
    let sql = `SELECT id, product_id, variant_name, variant_value, additional_price, 
                      is_active, created_at, updated_at 
               FROM product_variants WHERE id = ?`;
    let params = [id];

    if (productId) {
      sql += ` AND product_id = ?`;
      params.push(productId);
    }

    const [rows] = await pool.execute(sql, params);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      additional_price: parseFloat(rows[0].additional_price) || 0,
    };
  }

  /**
   * Create variant for a product
   */
  static async create({ productId, variant_name, variant_value, additional_price = 0, is_active = true }) {
    const sku = `SKU-${productId}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const [result] = await pool.execute(
      `INSERT INTO product_variants (product_id, variant_name, variant_value, additional_price, sku, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        productId,
        variant_name.trim(),
        variant_value.trim(),
        parseFloat(additional_price) || 0.00,
        sku,
        is_active ? 1 : 0
      ]
    );
    return result.insertId;
  }

  /**
   * Update variant
   */
  static async update(id, productId, { variant_name, variant_value, additional_price, is_active }) {
    const [result] = await pool.execute(
      `UPDATE product_variants 
       SET variant_name = ?, variant_value = ?, additional_price = ?, is_active = ?, updated_at = NOW() 
       WHERE id = ? AND product_id = ?`,
      [
        variant_name.trim(),
        variant_value.trim(),
        parseFloat(additional_price) || 0.00,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id,
        productId
      ]
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete variant
   */
  static async delete(id, productId) {
    const [result] = await pool.execute(
      `DELETE FROM product_variants WHERE id = ? AND product_id = ?`,
      [id, productId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = ProductVariant;
