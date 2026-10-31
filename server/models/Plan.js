const { pool } = require('../config/db');

class Plan {
  /**
   * Find plan by ID, joined with parent product
   */
  static async findById(id) {
    const query = `
      SELECT pl.id, pl.product_id, pl.name, pl.description, pl.code,
             pl.price, pl.billing_cycle, pl.minimum_quantity,
             pl.available_from, pl.available_until,
             pl.auto_close, pl.allow_pause, pl.allow_early_close, pl.allow_renewal,
             pl.is_active, pl.created_at, pl.updated_at,
             p.name as product_name, p.product_type, p.is_active as product_is_active
      FROM plans pl
      JOIN products p ON pl.product_id = p.id
      WHERE pl.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      price: parseFloat(row.price) || 0,
      minimum_quantity: parseInt(row.minimum_quantity, 10) || 1,
      auto_close: Boolean(row.auto_close),
      allow_pause: Boolean(row.allow_pause),
      allow_early_close: Boolean(row.allow_early_close),
      allow_renewal: Boolean(row.allow_renewal),
      is_active: Boolean(row.is_active),
      is_purchasable: Plan.checkPurchasable(row),
    };
  }

  /**
   * Evaluates if a plan can currently be purchased based on business rules:
   * 1. Plan must be active.
   * 2. Parent product must be active.
   * 3. Current time must be within availability window (available_from to available_until).
   */
  static checkPurchasable(plan) {
    if (!plan.is_active) return false;
    if (plan.product_is_active !== undefined && !plan.product_is_active) return false;

    const now = new Date();
    if (plan.available_from) {
      const fromDate = new Date(plan.available_from);
      if (now < fromDate) return false;
    }
    if (plan.available_until) {
      const untilDate = new Date(plan.available_until);
      if (now > untilDate) return false;
    }
    return true;
  }

  /**
   * List plans with filtering, search and pagination
   */
  static async findAll({ search = '', product_id = '', billing_cycle = '', status = '', page = 1, limit = 10 }) {
    let whereClauses = [];
    let params = [];

    if (search && search.trim() !== '') {
      whereClauses.push('(pl.name LIKE ? OR pl.description LIKE ? OR p.name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (product_id && product_id !== 'all' && product_id !== '') {
      whereClauses.push('pl.product_id = ?');
      params.push(parseInt(product_id, 10));
    }

    if (billing_cycle && billing_cycle !== 'all' && billing_cycle !== '') {
      whereClauses.push('pl.billing_cycle = ?');
      params.push(billing_cycle.trim());
    }

    if (status !== '' && status !== 'all') {
      if (status === 'active' || status === '1' || status === true) {
        whereClauses.push('pl.is_active = 1');
      } else if (status === 'inactive' || status === '0' || status === false) {
        whereClauses.push('pl.is_active = 0');
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total rows
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM plans pl
      JOIN products p ON pl.product_id = p.id
      ${whereSql}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;

    const dataQuery = `
      SELECT pl.id, pl.product_id, pl.name, pl.description, pl.code,
             pl.price, pl.billing_cycle, pl.minimum_quantity,
             pl.available_from, pl.available_until,
             pl.auto_close, pl.allow_pause, pl.allow_early_close, pl.allow_renewal,
             pl.is_active, pl.created_at, pl.updated_at,
             p.name as product_name, p.product_type, p.is_active as product_is_active
      FROM plans pl
      JOIN products p ON pl.product_id = p.id
      ${whereSql}
      ORDER BY pl.id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    const formattedPlans = rows.map((r) => ({
      ...r,
      price: parseFloat(r.price) || 0,
      minimum_quantity: parseInt(r.minimum_quantity, 10) || 1,
      auto_close: Boolean(r.auto_close),
      allow_pause: Boolean(r.allow_pause),
      allow_early_close: Boolean(r.allow_early_close),
      allow_renewal: Boolean(r.allow_renewal),
      is_active: Boolean(r.is_active),
      is_purchasable: Plan.checkPurchasable(r),
    }));

    return {
      plans: formattedPlans,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  /**
   * Create a new subscription plan
   */
  static async create({
    product_id,
    name,
    description = null,
    price = 0,
    billing_cycle = 'Monthly',
    minimum_quantity = 1,
    available_from = null,
    available_until = null,
    auto_close = false,
    allow_pause = true,
    allow_early_close = true,
    allow_renewal = true,
    is_active = true,
  }) {
    const code = `PLAN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const [result] = await pool.execute(
      `INSERT INTO plans (
        product_id, name, description, code, price, billing_cycle,
        minimum_quantity, available_from, available_until,
        auto_close, allow_pause, allow_early_close, allow_renewal,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        parseInt(product_id, 10),
        name.trim(),
        description ? description.trim() : null,
        code,
        parseFloat(price) || 0.00,
        billing_cycle,
        Math.max(1, parseInt(minimum_quantity, 10) || 1),
        available_from ? new Date(available_from) : null,
        available_until ? new Date(available_until) : null,
        auto_close ? 1 : 0,
        allow_pause ? 1 : 0,
        allow_early_close ? 1 : 0,
        allow_renewal ? 1 : 0,
        is_active ? 1 : 0,
      ]
    );

    return result.insertId;
  }

  /**
   * Update plan
   */
  static async update(id, {
    product_id,
    name,
    description,
    price,
    billing_cycle,
    minimum_quantity,
    available_from,
    available_until,
    auto_close,
    allow_pause,
    allow_early_close,
    allow_renewal,
    is_active,
  }) {
    const [result] = await pool.execute(
      `UPDATE plans 
       SET product_id = ?, name = ?, description = ?, price = ?, billing_cycle = ?,
           minimum_quantity = ?, available_from = ?, available_until = ?,
           auto_close = ?, allow_pause = ?, allow_early_close = ?, allow_renewal = ?,
           is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        parseInt(product_id, 10),
        name.trim(),
        description !== undefined ? (description ? description.trim() : null) : null,
        parseFloat(price) || 0.00,
        billing_cycle,
        Math.max(1, parseInt(minimum_quantity, 10) || 1),
        available_from ? new Date(available_from) : null,
        available_until ? new Date(available_until) : null,
        auto_close ? 1 : 0,
        allow_pause ? 1 : 0,
        allow_early_close ? 1 : 0,
        allow_renewal ? 1 : 0,
        is_active ? 1 : 0,
        id,
      ]
    );
    return result.affectedRows > 0;
  }

  /**
   * Toggle plan active status
   */
  static async setStatus(id, is_active) {
    const [result] = await pool.execute(
      `UPDATE plans SET is_active = ?, updated_at = NOW() WHERE id = ?`,
      [is_active ? 1 : 0, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Check if plan has historical subscriptions
   */
  static async hasReferences(id) {
    try {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ?`,
        [id]
      );
      if (rows[0].count > 0) return true;
    } catch (err) {
      // subscriptions table might not use plan_id or table is empty
    }
    return false;
  }

  /**
   * Delete plan permanently if not referenced
   */
  static async delete(id) {
    const [result] = await pool.execute(`DELETE FROM plans WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  }
}

module.exports = Plan;
