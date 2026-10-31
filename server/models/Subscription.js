const { pool } = require('../config/db');

class Subscription {
  /**
   * Helper to calculate next billing date based on start date and cycle
   */
  static calculateNextBillingDate(startDate, cycle) {
    // Parse as YYYY-MM-DD components
    const dateStr = typeof startDate === 'string' ? startDate.substring(0, 10) : new Date(startDate).toISOString().substring(0, 10);
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    const normalized = (cycle || 'Monthly').toLowerCase();

    if (normalized === 'daily') {
      d.setUTCDate(d.getUTCDate() + 1);
    } else if (normalized === 'weekly') {
      d.setUTCDate(d.getUTCDate() + 7);
    } else if (normalized === 'yearly') {
      d.setUTCFullYear(d.getUTCFullYear() + 1);
    } else {
      // Monthly
      d.setUTCMonth(d.getUTCMonth() + 1);
    }

    return d.toISOString().substring(0, 10);
  }

  /**
   * Find subscription by ID with joined customer, plan, and product
   */
  static async findById(id) {
    const query = `
      SELECT s.id, s.subscription_number, s.customer_id, s.plan_id,
             DATE_FORMAT(s.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(s.end_date, '%Y-%m-%d') as end_date,
             DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') as next_billing_date,
             s.status, s.billing_cycle, s.quantity,
             s.unit_price, s.total_amount, s.currency,
             s.auto_renew, s.notes, s.cancelled_at, s.cancel_reason,
             s.created_at, s.updated_at,
             c.name as customer_name, c.email as customer_email,
             c.phone as customer_phone, c.company_name as customer_company,
             c.user_id as customer_user_id,
             pl.name as plan_name, pl.description as plan_description,
             pl.price as plan_price, pl.allow_pause, pl.allow_early_close, pl.allow_renewal,
             p.name as product_name
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans pl ON s.plan_id = pl.id
      JOIN products p ON pl.product_id = p.id
      WHERE s.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      quantity: parseInt(row.quantity, 10) || 1,
      unit_price: parseFloat(row.unit_price) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      auto_renew: Boolean(row.auto_renew),
      allow_pause: Boolean(row.allow_pause),
      allow_early_close: Boolean(row.allow_early_close),
      allow_renewal: Boolean(row.allow_renewal),
    };
  }

  /**
   * Find all subscriptions with filters, search, pagination, and role scoping
   */
  static async findAll({ search = '', status = '', customer_id = '', userId = null, page = 1, limit = 10 }) {
    let whereClauses = [];
    let params = [];

    // Role scoping: if customer user, restrict to subscriptions linked to their customer profile
    if (userId) {
      whereClauses.push('c.user_id = ?');
      params.push(userId);
    }

    if (search && search.trim() !== '') {
      whereClauses.push('(s.subscription_number LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR pl.name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      whereClauses.push('s.status = ?');
      params.push(status.trim());
    }

    if (customer_id && customer_id !== 'all') {
      whereClauses.push('s.customer_id = ?');
      params.push(parseInt(customer_id, 10));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans pl ON s.plan_id = pl.id
      ${whereSql}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Metrics query
    let metricsWhere = '';
    let metricsParams = [];
    if (userId) {
      metricsWhere = 'WHERE c.user_id = ?';
      metricsParams.push(userId);
    }

    const [metricRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN s.status = 'paused' THEN 1 ELSE 0 END) as paused_count,
        SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      ${metricsWhere}
    `, metricsParams);

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;

    const dataQuery = `
      SELECT s.id, s.subscription_number, s.customer_id, s.plan_id,
             DATE_FORMAT(s.start_date, '%Y-%m-%d') as start_date,
             DATE_FORMAT(s.end_date, '%Y-%m-%d') as end_date,
             DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') as next_billing_date,
             s.status, s.billing_cycle, s.quantity,
             s.unit_price, s.total_amount, s.currency,
             s.auto_renew, s.notes, s.created_at, s.updated_at,
             c.name as customer_name, c.email as customer_email,
             c.company_name as customer_company,
             pl.name as plan_name, pl.allow_pause, pl.allow_early_close, pl.allow_renewal,
             p.name as product_name
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans pl ON s.plan_id = pl.id
      JOIN products p ON pl.product_id = p.id
      ${whereSql}
      ORDER BY s.id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    const formatted = rows.map((r) => ({
      ...r,
      quantity: parseInt(r.quantity, 10) || 1,
      unit_price: parseFloat(r.unit_price) || 0,
      total_amount: parseFloat(r.total_amount) || 0,
      auto_renew: Boolean(r.auto_renew),
      allow_pause: Boolean(r.allow_pause),
      allow_early_close: Boolean(r.allow_early_close),
      allow_renewal: Boolean(r.allow_renewal),
    }));

    return {
      subscriptions: formatted,
      metrics: {
        total: metricRows[0].total_count || 0,
        active: metricRows[0].active_count || 0,
        paused: metricRows[0].paused_count || 0,
        cancelled: metricRows[0].cancelled_count || 0,
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
   * Create new subscription using database transactions
   */
  static async create({
    customer_id,
    plan_id,
    subscription_number,
    quantity = 1,
    start_date,
    end_date = null,
    auto_renew = true,
    notes = null,
    status = 'draft',
    unit_price,
    total_amount,
    billing_cycle,
    next_billing_date,
    current_period_start,
    current_period_end,
    items,
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let effectivePlanId = plan_id || (items && items[0] && items[0].plan_id);
      let effectiveQuantity = quantity || (items && items[0] && items[0].quantity) || 1;
      let effectiveUnitPrice = unit_price !== undefined ? unit_price : (items && items[0] && items[0].unit_price);
      let effectiveBillingCycle = billing_cycle || 'monthly';

      if (effectivePlanId && (effectiveUnitPrice === undefined || !billing_cycle)) {
        const [planRows] = await connection.execute('SELECT price, billing_interval FROM plans WHERE id = ?', [effectivePlanId]);
        if (planRows.length > 0) {
          if (effectiveUnitPrice === undefined) effectiveUnitPrice = parseFloat(planRows[0].price) || 0;
          if (!billing_cycle) effectiveBillingCycle = planRows[0].billing_interval || 'monthly';
        }
      }

      effectiveUnitPrice = parseFloat(effectiveUnitPrice) || 0;
      const effectiveTotalAmount = total_amount !== undefined ? parseFloat(total_amount) : (effectiveUnitPrice * effectiveQuantity);
      const effectiveStartDate = start_date || current_period_start || new Date().toISOString().substring(0, 10);
      const effectiveEndDate = end_date || current_period_end || null;

      let effectiveNextBillingDate = next_billing_date;
      if (!effectiveNextBillingDate) {
        const dt = new Date(effectiveStartDate);
        if (effectiveBillingCycle === 'daily') dt.setDate(dt.getDate() + 1);
        else if (effectiveBillingCycle === 'weekly') dt.setDate(dt.getDate() + 7);
        else if (effectiveBillingCycle === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
        else dt.setMonth(dt.getMonth() + 1);
        effectiveNextBillingDate = dt.toISOString().substring(0, 10);
      }

      const subscriptionNumber = subscription_number || `SUB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

      const [res] = await connection.execute(
        `INSERT INTO subscriptions (
          subscription_number, customer_id, plan_id,
          start_date, end_date, next_billing_date,
          status, billing_cycle, quantity,
          unit_price, total_amount, currency,
          current_period_start, current_period_end,
          auto_renew, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, NOW(), NOW())`,
        [
          subscriptionNumber,
          parseInt(customer_id, 10),
          parseInt(effectivePlanId, 10),
          effectiveStartDate,
          effectiveEndDate,
          effectiveNextBillingDate,
          status,
          effectiveBillingCycle,
          effectiveQuantity,
          effectiveUnitPrice,
          effectiveTotalAmount,
          effectiveStartDate,
          effectiveEndDate || effectiveNextBillingDate,
          auto_renew ? 1 : 0,
          notes || null,
        ]
      );

      const subscriptionId = res.insertId;

      // Add corresponding record to subscription_items for audit integrity
      await connection.execute(
        `INSERT INTO subscription_items (
          subscription_id, plan_id, quantity, unit_price, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [subscriptionId, effectivePlanId, effectiveQuantity, effectiveUnitPrice]
      );

      await connection.commit();
      return subscriptionId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Update subscription fields (quantity, end_date, auto_renew, notes)
   */
  static async update(id, { quantity, unit_price, total_amount, next_billing_date, end_date, auto_renew, notes }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `UPDATE subscriptions
         SET quantity = COALESCE(?, quantity),
             unit_price = COALESCE(?, unit_price),
             total_amount = COALESCE(?, total_amount),
             next_billing_date = COALESCE(?, next_billing_date),
             end_date = ?,
             auto_renew = COALESCE(?, auto_renew),
             notes = COALESCE(?, notes),
             updated_at = NOW()
         WHERE id = ?`,
        [
          quantity !== undefined ? quantity : null,
          unit_price !== undefined ? unit_price : null,
          total_amount !== undefined ? total_amount : null,
          next_billing_date || null,
          end_date !== undefined ? (end_date || null) : null,
          auto_renew !== undefined ? (auto_renew ? 1 : 0) : null,
          notes !== undefined ? notes : null,
          id,
        ]
      );

      if (quantity !== undefined || unit_price !== undefined) {
        await connection.execute(
          `UPDATE subscription_items
           SET quantity = COALESCE(?, quantity),
               unit_price = COALESCE(?, unit_price),
               updated_at = NOW()
           WHERE subscription_id = ?`,
          [quantity !== undefined ? quantity : null, unit_price !== undefined ? unit_price : null, id]
        );
      }

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Set subscription status with validation timestamp
   */
  static async setStatus(id, newStatus, cancelReason = null) {
    let extraSql = '';
    let params = [newStatus];

    if (newStatus === 'cancelled') {
      extraSql = ', cancelled_at = NOW(), cancel_reason = ?';
      params.push(cancelReason || 'Cancelled by user or administrator');
    }

    params.push(id);

    const [res] = await pool.execute(
      `UPDATE subscriptions SET status = ? ${extraSql}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return res.affectedRows > 0;
  }

  /**
   * Alias for setStatus
   */
  static async updateStatus(id, newStatus, cancelReason = null) {
    return this.setStatus(id, newStatus, cancelReason);
  }

  /**
   * Renew subscription by pushing next_billing_date forward
   */
  static async renew(id, nextDate) {
    const [res] = await pool.execute(
      `UPDATE subscriptions SET next_billing_date = ?, updated_at = NOW() WHERE id = ?`,
      [nextDate, id]
    );
    return res.affectedRows > 0;
  }
}

module.exports = Subscription;
