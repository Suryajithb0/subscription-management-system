const { pool } = require('../config/db');

class Customer {
  /**
   * Find customer by ID
   */
  static async findById(id) {
    const query = `
      SELECT id, user_id, 
             COALESCE(NULLIF(TRIM(name), ''), CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) as name,
             email, phone, company_name, 
             COALESCE(address, billing_address) as address,
             status, created_at, updated_at
      FROM customers
      WHERE id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  /**
   * Find customer by email (to prevent duplicate emails)
   */
  static async findByEmail(email, excludeId = null) {
    let query = `SELECT id, email FROM customers WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))`;
    let params = [email];
    if (excludeId) {
      query += ` AND id != ?`;
      params.push(excludeId);
    }
    const [rows] = await pool.execute(query, params);
    return rows[0] || null;
  }

  /**
   * Find customer by user_id (for ownership checks)
   */
  static async findByUserId(userId) {
    const query = `
      SELECT id, user_id, 
             COALESCE(NULLIF(TRIM(name), ''), CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) as name,
             email, phone, company_name, address, status, created_at, updated_at
      FROM customers
      WHERE user_id = ?
    `;
    const [rows] = await pool.execute(query, [userId]);
    return rows[0] || null;
  }

  /**
   * List customers with search, status filtering, sorting, and pagination
   */
  static async findAll({ search = '', status = '', page = 1, limit = 10, sort = 'created_at', order = 'DESC' }) {
    let whereClauses = [];
    let params = [];

    if (search && search.trim() !== '') {
      whereClauses.push('(name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (status && status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status.trim());
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count matching
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM customers ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    // Metrics summary (total, active, new within last 30 days)
    const [metricsRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_customers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_customers,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_customers
      FROM customers
    `);

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;
    const safeOrder = (order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT id, user_id,
             COALESCE(NULLIF(TRIM(name), ''), CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))) as name,
             email, phone, company_name,
             COALESCE(address, billing_address) as address,
             status, created_at, updated_at
      FROM customers
      ${whereSql}
      ORDER BY created_at ${safeOrder}
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    return {
      customers: rows,
      metrics: {
        total: metricsRows[0].total_customers || 0,
        active: metricsRows[0].active_customers || 0,
        new30Days: metricsRows[0].new_customers || 0,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  /**
   * Create a customer
   */
  static async create({ name, email, phone = null, company_name = null, address = null, user_id = null }) {
    const cleanName = name.trim();
    const cleanEmail = email.toLowerCase().trim();
    const nameParts = cleanName.split(/\s+/);
    const firstName = nameParts[0] || cleanName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const [result] = await pool.execute(
      `INSERT INTO customers (
        user_id, name, first_name, last_name, email, phone,
        company_name, address, billing_address, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        user_id || null,
        cleanName,
        firstName,
        lastName,
        cleanEmail,
        phone ? phone.trim() : null,
        company_name ? company_name.trim() : null,
        address ? address.trim() : null,
        address ? address.trim() : null,
      ]
    );

    return result.insertId;
  }

  static async update(id, updates = {}) {
    const existing = await Customer.findById(id);
    if (!existing) return false;

    const cleanName = updates.name !== undefined ? updates.name.trim() : (existing.name || '');
    const nameParts = cleanName.split(/\s+/);
    const firstName = nameParts[0] || cleanName;
    const lastName = nameParts.slice(1).join(' ') || '';
    const cleanEmail = updates.email !== undefined ? updates.email.toLowerCase().trim() : (existing.email || '').toLowerCase().trim();
    const phone = updates.phone !== undefined ? (updates.phone ? updates.phone.trim() : null) : existing.phone;
    const company_name = updates.company_name !== undefined ? (updates.company_name ? updates.company_name.trim() : null) : existing.company_name;
    const address = updates.address !== undefined ? (updates.address ? updates.address.trim() : null) : existing.address;
    const status = updates.status !== undefined ? updates.status : existing.status;

    const [result] = await pool.execute(
      `UPDATE customers 
       SET name = ?, first_name = ?, last_name = ?, email = ?,
           phone = ?, company_name = ?, address = ?, billing_address = ?,
           status = COALESCE(?, status), updated_at = NOW()
       WHERE id = ?`,
      [
        cleanName,
        firstName,
        lastName,
        cleanEmail,
        phone,
        company_name,
        address,
        address,
        status,
        id,
      ]
    );

    return result.affectedRows > 0;
  }

  /**
   * Toggle status (active / inactive / archived)
   */
  static async setStatus(id, status) {
    const [result] = await pool.execute(
      `UPDATE customers SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Check if customer has linked financial or subscription history
   */
  static async hasReferences(id) {
    try {
      const [subRows] = await pool.execute(
        `SELECT COUNT(*) as count FROM subscriptions WHERE customer_id = ?`,
        [id]
      );
      if (subRows[0].count > 0) return true;
    } catch (err) {}

    try {
      const [invRows] = await pool.execute(
        `SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?`,
        [id]
      );
      if (invRows[0].count > 0) return true;
    } catch (err) {}

    return false;
  }

  /**
   * Permanently delete customer
   */
  static async delete(id) {
    const [result] = await pool.execute(`DELETE FROM customers WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Customer;
