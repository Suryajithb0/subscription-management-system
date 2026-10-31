const { pool } = require('../config/db');

class Discount {
  /**
   * Create a new promotional discount / coupon
   */
  static async create({
    name,
    code,
    description = null,
    type = 'percentage',
    value,
    min_purchase_amount = 0,
    max_discount_amount = null,
    start_date = null,
    end_date = null,
    expiry_date = null,
    usage_limit = null,
    max_uses = null,
    per_customer_limit = 1,
    is_active = 1
  }) {
    const cleanCode = code ? code.toUpperCase().trim() : '';
    if (!cleanCode) {
      throw new Error('Coupon code is required.');
    }

    const discValue = parseFloat(value);
    if (isNaN(discValue) || discValue <= 0) {
      throw new Error('Discount value must be greater than zero.');
    }

    // Verify uniqueness
    const [existing] = await pool.execute(
      'SELECT id FROM discounts WHERE code = ?',
      [cleanCode]
    );
    if (existing.length > 0) {
      throw new Error(`Discount coupon with code '${cleanCode}' already exists.`);
    }

    const finalStartDate = start_date || new Date().toISOString().substring(0, 10);
    const finalExpiryDate = expiry_date || end_date || null;
    const finalUsageLimit = usage_limit ?? max_uses ?? null;

    const [res] = await pool.execute(
      `INSERT INTO discounts (
        name, code, description, type, value,
        min_purchase_amount, max_discount_amount,
        start_date, end_date, expiry_date,
        max_uses, usage_limit, per_customer_limit,
        uses_count, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [
        name ? name.trim() : cleanCode,
        cleanCode,
        description ? description.trim() : null,
        type === 'fixed_amount' ? 'fixed' : type,
        discValue,
        parseFloat(min_purchase_amount) || 0,
        max_discount_amount !== null && max_discount_amount !== '' ? parseFloat(max_discount_amount) : null,
        finalStartDate,
        finalExpiryDate,
        finalExpiryDate,
        finalUsageLimit,
        finalUsageLimit,
        parseInt(per_customer_limit, 10) || 1,
        is_active ? 1 : 0
      ]
    );

    return res.insertId;
  }

  /**
   * List all discounts with filters and metrics
   */
  static async findAll({ search = '', type = '', status = '', page = 1, limit = 20 }) {
    let whereClauses = [];
    let params = [];

    if (search && search.trim() !== '') {
      whereClauses.push('(name LIKE ? OR code LIKE ? OR description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (type && type !== 'all') {
      whereClauses.push('type = ?');
      params.push(type.trim());
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        whereClauses.push('is_active = 1 AND (expiry_date IS NULL OR expiry_date >= CURDATE())');
      } else if (status === 'inactive') {
        whereClauses.push('is_active = 0');
      } else if (status === 'expired') {
        whereClauses.push('expiry_date IS NOT NULL AND expiry_date < CURDATE()');
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM discounts ${whereSql}`;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Metrics query
    const [metricRows] = await pool.execute(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN is_active = 1 AND (expiry_date IS NULL OR expiry_date >= CURDATE()) THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_count,
        COALESCE(SUM(uses_count), 0) as total_uses
      FROM discounts
    `);

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (safePage - 1) * safeLimit;

    const dataQuery = `
      SELECT 
        id, name, code, description, type, value,
        min_purchase_amount, max_discount_amount,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(expiry_date, '%Y-%m-%d') as expiry_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        usage_limit, max_uses, uses_count, per_customer_limit,
        is_active, created_at, updated_at
      FROM discounts
      ${whereSql}
      ORDER BY id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    const formatted = rows.map((r) => {
      const isExpired = r.expiry_date && new Date(r.expiry_date) < new Date(new Date().toDateString());
      let derivedStatus = 'active';
      if (!r.is_active) derivedStatus = 'inactive';
      else if (isExpired) derivedStatus = 'expired';

      return {
        ...r,
        value: parseFloat(r.value) || 0,
        min_purchase_amount: parseFloat(r.min_purchase_amount) || 0,
        max_discount_amount: r.max_discount_amount ? parseFloat(r.max_discount_amount) : null,
        status: derivedStatus,
        expiry_date: r.expiry_date || r.end_date
      };
    });

    return {
      discounts: formatted,
      metrics: {
        total: metricRows[0].total_count || 0,
        active: metricRows[0].active_count || 0,
        expired: metricRows[0].expired_count || 0,
        totalUsage: metricRows[0].total_uses || 0
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1
      }
    };
  }

  /**
   * Find single discount by ID with recent usages
   */
  static async findById(id) {
    const query = `
      SELECT 
        id, name, code, description, type, value,
        min_purchase_amount, max_discount_amount,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(expiry_date, '%Y-%m-%d') as expiry_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') as end_date,
        usage_limit, max_uses, uses_count, per_customer_limit,
        is_active, created_at, updated_at
      FROM discounts
      WHERE id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    if (!rows[0]) return null;

    const row = rows[0];

    // Fetch recent usages
    const [usages] = await pool.execute(
      `SELECT 
        du.id, du.discount_id, du.customer_id, du.invoice_id,
        du.amount_discounted, du.applied_at,
        c.name as customer_name, c.email as customer_email,
        i.invoice_number
       FROM discount_usages du
       LEFT JOIN customers c ON du.customer_id = c.id
       LEFT JOIN invoices i ON du.invoice_id = i.id
       WHERE du.discount_id = ?
       ORDER BY du.id DESC
       LIMIT 20`,
      [id]
    );

    return {
      ...row,
      value: parseFloat(row.value) || 0,
      min_purchase_amount: parseFloat(row.min_purchase_amount) || 0,
      max_discount_amount: row.max_discount_amount ? parseFloat(row.max_discount_amount) : null,
      expiry_date: row.expiry_date || row.end_date,
      usages: usages.map(u => ({
        ...u,
        amount_discounted: parseFloat(u.amount_discounted) || 0
      }))
    };
  }

  /**
   * Update discount
   */
  static async update(id, {
    name,
    code,
    description,
    type,
    value,
    min_purchase_amount,
    max_discount_amount,
    start_date,
    end_date,
    expiry_date,
    usage_limit,
    per_customer_limit,
    is_active
  }) {
    const finalExpiryDate = expiry_date || end_date || null;
    const finalUsageLimit = usage_limit !== undefined ? usage_limit : null;

    const [result] = await pool.execute(
      `UPDATE discounts SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        description = ?,
        type = COALESCE(?, type),
        value = COALESCE(?, value),
        min_purchase_amount = COALESCE(?, min_purchase_amount),
        max_discount_amount = ?,
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        expiry_date = COALESCE(?, expiry_date),
        usage_limit = COALESCE(?, usage_limit),
        max_uses = COALESCE(?, max_uses),
        per_customer_limit = COALESCE(?, per_customer_limit),
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
      WHERE id = ?`,
      [
        name ? name.trim() : null,
        code ? code.toUpperCase().trim() : null,
        description ? description.trim() : null,
        type ? (type === 'fixed_amount' ? 'fixed' : type) : null,
        value !== undefined ? parseFloat(value) : null,
        min_purchase_amount !== undefined ? parseFloat(min_purchase_amount) : null,
        max_discount_amount !== undefined && max_discount_amount !== '' ? parseFloat(max_discount_amount) : null,
        start_date || null,
        finalExpiryDate,
        finalExpiryDate,
        finalUsageLimit,
        finalUsageLimit,
        per_customer_limit !== undefined ? parseInt(per_customer_limit, 10) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );

    return result.affectedRows > 0;
  }

  /**
   * Safely deactivate / archive discount
   */
  static async delete(id) {
    const [result] = await pool.execute(
      `UPDATE discounts SET is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Validate coupon code against purchase / invoice amount with server-side calculations
   */
  static async validateCoupon({ code, customer_id = null, amount = 0, invoice_id = null }) {
    if (!code || code.trim() === '') {
      throw new Error('Please enter a coupon code.');
    }

    const cleanCode = code.toUpperCase().trim();
    const purchaseAmount = Math.max(0, parseFloat(amount) || 0);

    const [rows] = await pool.execute(
      `SELECT 
        id, name, code, description, type, value,
        min_purchase_amount, max_discount_amount,
        DATE_FORMAT(start_date, '%Y-%m-%d') as start_date,
        DATE_FORMAT(COALESCE(expiry_date, end_date), '%Y-%m-%d') as expiry_date,
        COALESCE(usage_limit, max_uses) as usage_limit,
        uses_count, per_customer_limit, is_active
       FROM discounts
       WHERE code = ?`,
      [cleanCode]
    );

    if (!rows[0]) {
      throw new Error(`Coupon code '${cleanCode}' does not exist.`);
    }

    const disc = rows[0];

    // 1. Active check
    if (!disc.is_active) {
      throw new Error(`Coupon code '${cleanCode}' is currently inactive.`);
    }

    // 2. Start date check
    const todayStr = new Date().toISOString().substring(0, 10);
    if (disc.start_date && disc.start_date > todayStr) {
      throw new Error(`Coupon code '${cleanCode}' is not active yet (starts on ${disc.start_date}).`);
    }

    // 3. Expiry date check
    if (disc.expiry_date && disc.expiry_date < todayStr) {
      throw new Error(`Coupon code '${cleanCode}' expired on ${disc.expiry_date}.`);
    }

    // 4. Minimum purchase amount check
    const minAmount = parseFloat(disc.min_purchase_amount) || 0;
    if (purchaseAmount < minAmount) {
      throw new Error(
        `Minimum purchase amount of $${minAmount.toFixed(2)} required to use coupon '${cleanCode}' (current total: $${purchaseAmount.toFixed(2)}).`
      );
    }

    // 5. Global usage limit check
    if (disc.usage_limit && disc.uses_count >= disc.usage_limit) {
      throw new Error(`Coupon code '${cleanCode}' has reached its maximum total usage limit.`);
    }

    // 6. Per-customer usage limit check
    if (customer_id) {
      const [usageRows] = await pool.execute(
        `SELECT COUNT(*) as user_uses FROM discount_usages WHERE discount_id = ? AND customer_id = ?`,
        [disc.id, customer_id]
      );
      const userUses = usageRows[0].user_uses;
      const perLimit = disc.per_customer_limit || 1;
      if (userUses >= perLimit) {
        throw new Error(
          `You have already used coupon '${cleanCode}' the maximum allowed number of times (${perLimit}x).`
        );
      }
    }

    // 7. Calculate discount amount safely on backend
    let calculatedDiscount = 0;
    const discVal = parseFloat(disc.value) || 0;

    if (disc.type === 'percentage') {
      calculatedDiscount = Math.round((purchaseAmount * (discVal / 100)) * 100) / 100;
      // Cap at maximum discount amount if specified
      if (disc.max_discount_amount) {
        const maxDisc = parseFloat(disc.max_discount_amount);
        calculatedDiscount = Math.min(calculatedDiscount, maxDisc);
      }
    } else {
      // Fixed amount
      calculatedDiscount = Math.min(purchaseAmount, discVal);
    }

    // Never exceed purchase amount or drop below zero
    calculatedDiscount = Math.max(0, Math.min(purchaseAmount, calculatedDiscount));
    const netTotal = Math.max(0, Math.round((purchaseAmount - calculatedDiscount) * 100) / 100);

    return {
      valid: true,
      discount_id: disc.id,
      code: disc.code,
      name: disc.name,
      type: disc.type,
      value: discVal,
      discount_amount: calculatedDiscount,
      net_total: netTotal
    };
  }

  /**
   * Record discount usage into discount_usages table and increment uses_count
   */
  static async recordUsage({ discount_id, customer_id, invoice_id = null, subscription_id = null, amount_discounted }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO discount_usages (
          discount_id, customer_id, invoice_id, subscription_id,
          amount_discounted, applied_at
        ) VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          discount_id,
          customer_id,
          invoice_id || null,
          subscription_id || null,
          parseFloat(amount_discounted) || 0
        ]
      );

      await connection.execute(
        `UPDATE discounts SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = ?`,
        [discount_id]
      );

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = Discount;
