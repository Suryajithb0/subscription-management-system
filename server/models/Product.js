const { pool } = require('../config/db');

class Product {
  /**
   * Find product by ID (including variant count and active status)
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, name, code, description, product_type, sales_price, cost_price, notes, is_active, created_at, updated_at 
       FROM products 
       WHERE id = ?`,
      [id]
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      sales_price: parseFloat(rows[0].sales_price) || 0,
      cost_price: parseFloat(rows[0].cost_price) || 0,
    };
  }

  /**
   * List products with search, filtering, and pagination
   */
  static async findAll({ search = '', product_type = '', status = '', page = 1, limit = 10 }) {
    let whereClauses = [];
    let params = [];

    if (search && search.trim() !== '') {
      whereClauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.notes LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (product_type && product_type.trim() !== '' && product_type !== 'all') {
      whereClauses.push('p.product_type = ?');
      params.push(product_type.trim());
    }

    if (status !== '' && status !== 'all') {
      if (status === 'active' || status === '1' || status === true) {
        whereClauses.push('p.is_active = 1');
      } else if (status === 'inactive' || status === '0' || status === false) {
        whereClauses.push('p.is_active = 0');
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total rows matching filters
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM products p ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    // Calculate pagination offsets
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;

    // Fetch paginated rows with variant counts
    const query = `
      SELECT p.id, p.name, p.code, p.description, p.product_type, 
             p.sales_price, p.cost_price, 
             p.notes, p.is_active, p.created_at, p.updated_at,
             COUNT(pv.id) as variants_count
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      ${whereSql}
      GROUP BY p.id
      ORDER BY p.id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(query, params);

    const formattedProducts = rows.map((p) => ({
      ...p,
      sales_price: parseFloat(p.sales_price) || 0,
      cost_price: parseFloat(p.cost_price) || 0,
      variants_count: parseInt(p.variants_count, 10) || 0,
    }));

    return {
      products: formattedProducts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      }
    };
  }

  /**
   * Create new product
   */
  static async create({ name, description = null, product_type = 'digital', sales_price = 0, cost_price = 0, notes = null, is_active = true }) {
    const code = `PROD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const [result] = await pool.execute(
      `INSERT INTO products (name, code, description, product_type, sales_price, cost_price, notes, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        name.trim(),
        code,
        description ? description.trim() : null,
        product_type.trim(),
        parseFloat(sales_price) || 0.00,
        parseFloat(cost_price) || 0.00,
        notes ? notes.trim() : null,
        is_active ? 1 : 0
      ]
    );

    return result.insertId;
  }

  /**
   * Update existing product
   */
  static async update(id, updates = {}) {
    const existing = await Product.findById(id);
    if (!existing) return false;

    const name = updates.name !== undefined ? updates.name.trim() : existing.name;
    const description = updates.description !== undefined ? (updates.description ? updates.description.trim() : null) : existing.description;
    const product_type = updates.product_type !== undefined ? updates.product_type.trim() : (existing.product_type || 'digital');
    const sales_price = updates.sales_price !== undefined ? (parseFloat(updates.sales_price) || 0.00) : (parseFloat(existing.sales_price) || 0.00);
    const cost_price = updates.cost_price !== undefined ? (parseFloat(updates.cost_price) || 0.00) : (parseFloat(existing.cost_price) || 0.00);
    const notes = updates.notes !== undefined ? (updates.notes ? updates.notes.trim() : null) : existing.notes;
    const is_active = updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : (existing.is_active ? 1 : 0);

    const [result] = await pool.execute(
      `UPDATE products 
       SET name = ?, description = ?, product_type = ?, sales_price = ?, cost_price = ?, notes = ?, is_active = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, description, product_type, sales_price, cost_price, notes, is_active, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Toggle or set status (is_active)
   */
  static async setStatus(id, is_active) {
    const [result] = await pool.execute(
      `UPDATE products SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [is_active ? 1 : 0, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Check for historical dependencies (e.g. plans, quotations, subscriptions)
   */
  static async hasReferences(id) {
    const [planRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM plans WHERE product_id = ?`,
      [id]
    );
    if (planRows[0].count > 0) return true;

    // Check quotation_items if table exists
    try {
      const [quoteRows] = await pool.execute(
        `SELECT COUNT(*) as count FROM quotation_items WHERE product_id = ?`,
        [id]
      );
      if (quoteRows[0].count > 0) return true;
    } catch (e) {
      // Table may not have product_id column
    }

    return false;
  }

  /**
   * Delete product permanently if no historical references
   */
  static async delete(id) {
    // Delete child variants first within transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(`DELETE FROM product_variants WHERE product_id = ?`, [id]);
      const [res] = await connection.execute(`DELETE FROM products WHERE id = ?`, [id]);
      await connection.commit();
      return res.affectedRows > 0;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = Product;
