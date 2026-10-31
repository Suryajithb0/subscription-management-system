const { pool } = require('../config/db');

class Payment {
  /**
   * Generate a guaranteed unique, human-friendly payment number
   * Format: PAY-YYYYMM-XXXX
   */
  static async generatePaymentNumber(connection = null) {
    const executor = connection || pool;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `PAY-${yearMonth}-`;

    const [rows] = await executor.execute(
      `SELECT payment_number FROM payments WHERE payment_number LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNum = 1001;
    if (rows.length > 0 && rows[0].payment_number) {
      const parts = rows[0].payment_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }

    let candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await executor.execute(
        `SELECT id FROM payments WHERE payment_number = ?`,
        [candidate]
      );
      if (existing.length === 0) {
        return candidate;
      }
      nextNum += 1;
      candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
      attempts++;
    }

    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  /**
   * Record a payment against an invoice with transactional database safety
   */
  static async create({
    invoice_id,
    customer_id = null,
    amount,
    payment_method,
    transaction_reference = null,
    payment_date = null,
    status = 'completed',
    notes = null
  }) {
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch invoice with lock to verify balance and status
      const [invRows] = await connection.execute(
        `SELECT id, invoice_number, customer_id, total, amount_paid, balance_due, amount_due, status, currency
         FROM invoices
         WHERE id = ? FOR UPDATE`,
        [invoice_id]
      );

      if (!invRows[0]) {
        throw new Error(`Invoice with ID ${invoice_id} not found.`);
      }

      const inv = invRows[0];
      const invTotal = parseFloat(inv.total) || 0;
      const currentPaid = parseFloat(inv.amount_paid) || 0;
      const outstandingBalance = Math.max(0, Math.round((invTotal - currentPaid) * 100) / 100);

      // Check invoice eligibility
      if (inv.status === 'cancelled' || inv.status === 'void') {
        throw new Error(`Cannot record payment against a ${inv.status} invoice.`);
      }

      if (inv.status === 'paid' && outstandingBalance <= 0) {
        throw new Error(`Invoice #${inv.invoice_number} is already fully paid.`);
      }

      // Check payment does not exceed outstanding balance
      if (payAmount > outstandingBalance + 0.001) {
        throw new Error(
          `Payment amount ($${payAmount.toFixed(2)}) exceeds outstanding balance ($${outstandingBalance.toFixed(2)}) on invoice #${inv.invoice_number}.`
        );
      }

      // Determine customer ID
      const finalCustomerId = customer_id ? parseInt(customer_id, 10) : inv.customer_id;

      // Duplicate transaction reference check if supplied
      if (transaction_reference && transaction_reference.trim() !== '') {
        const [refRows] = await connection.execute(
          `SELECT id, payment_number FROM payments WHERE transaction_reference = ? AND status = 'completed'`,
          [transaction_reference.trim()]
        );
        if (refRows.length > 0) {
          throw new Error(`A completed payment with transaction reference '${transaction_reference}' already exists (${refRows[0].payment_number}).`);
        }
      }

      const paymentNumber = await this.generatePaymentNumber(connection);
      const paymentDate = payment_date || new Date().toISOString().substring(0, 10);

      // Normalize payment method
      const methodMapping = {
        card: 'credit_card',
        credit_card: 'credit_card',
        bank_transfer: 'bank_transfer',
        upi: 'upi',
        cash: 'cash',
        paypal: 'paypal',
        other: 'other'
      };
      const cleanMethod = methodMapping[payment_method?.toLowerCase()] || 'other';

      // 2. Insert payment record
      const [payRes] = await connection.execute(
        `INSERT INTO payments (
          payment_number, invoice_id, customer_id, amount, currency,
          payment_method, transaction_reference, status, payment_date, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          paymentNumber,
          invoice_id,
          finalCustomerId,
          payAmount,
          inv.currency || 'USD',
          cleanMethod,
          transaction_reference ? transaction_reference.trim() : null,
          status,
          paymentDate,
          notes ? notes.trim() : null
        ]
      );

      const paymentId = payRes.insertId;

      // 3. Update invoice if payment is completed
      if (status === 'completed') {
        const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
        const newBalance = Math.max(0, Math.round((invTotal - newPaid) * 100) / 100);
        const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

        await connection.execute(
          `UPDATE invoices SET
            amount_paid = ?,
            balance_due = ?,
            amount_due = ?,
            status = ?,
            paid_at = (CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END),
            updated_at = NOW()
          WHERE id = ?`,
          [newPaid, newBalance, newBalance, newStatus, newStatus, invoice_id]
        );
      }

      await connection.commit();
      return paymentId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * List payments with search, filters, pagination, and role scoping
   */
  static async findAll({
    search = '',
    status = '',
    payment_method = '',
    customer_id = '',
    invoice_id = '',
    userId = null,
    page = 1,
    limit = 10
  }) {
    let whereClauses = [];
    let params = [];

    // Role Scoping: Customers only see their payments
    if (userId) {
      whereClauses.push('c.user_id = ?');
      params.push(userId);
    }

    if (search && search.trim() !== '') {
      whereClauses.push('(p.payment_number LIKE ? OR p.transaction_reference LIKE ? OR i.invoice_number LIKE ? OR c.name LIKE ? OR c.email LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term);
    }

    if (status && status !== 'all') {
      whereClauses.push('p.status = ?');
      params.push(status.trim());
    }

    if (payment_method && payment_method !== 'all') {
      whereClauses.push('p.payment_method = ?');
      params.push(payment_method.trim());
    }

    if (customer_id && customer_id !== 'all') {
      whereClauses.push('p.customer_id = ?');
      params.push(parseInt(customer_id, 10));
    }

    if (invoice_id && invoice_id !== 'all') {
      whereClauses.push('p.invoice_id = ?');
      params.push(parseInt(invoice_id, 10));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      ${whereSql}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Metrics summary query
    let metricsWhere = '';
    let metricsParams = [];
    if (userId) {
      metricsWhere = 'WHERE c.user_id = ?';
      metricsParams.push(userId);
    }

    const [metricRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN p.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN p.status = 'refunded' THEN 1 ELSE 0 END) as refunded_count,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as total_pending
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      ${metricsWhere}
    `, metricsParams);

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;

    const dataQuery = `
      SELECT 
        p.id, p.payment_number, p.invoice_id, p.customer_id,
        p.amount, p.currency, p.payment_method, p.transaction_reference,
        p.status,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
        p.notes, p.created_at, p.updated_at,
        i.invoice_number, i.total as invoice_total, i.balance_due as invoice_balance,
        i.status as invoice_status,
        c.name as customer_name, c.email as customer_email, c.company_name as customer_company
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      ${whereSql}
      ORDER BY p.id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    const formatted = rows.map((r) => ({
      ...r,
      amount: parseFloat(r.amount) || 0,
      invoice_total: parseFloat(r.invoice_total) || 0,
      invoice_balance: parseFloat(r.invoice_balance) || 0
    }));

    return {
      payments: formatted,
      metrics: {
        total: metricRows[0].total_count || 0,
        completed: metricRows[0].completed_count || 0,
        pending: metricRows[0].pending_count || 0,
        failed: metricRows[0].failed_count || 0,
        refunded: metricRows[0].refunded_count || 0,
        totalCollected: parseFloat(metricRows[0].total_collected || 0),
        totalPending: parseFloat(metricRows[0].total_pending || 0)
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
   * Find single payment by ID
   */
  static async findById(id) {
    const query = `
      SELECT 
        p.id, p.payment_number, p.invoice_id, p.customer_id,
        p.amount, p.currency, p.payment_method, p.transaction_reference,
        p.status,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
        p.notes, p.created_at, p.updated_at,
        i.invoice_number, i.total as invoice_total, i.balance_due as invoice_balance,
        i.status as invoice_status,
        c.name as customer_name, c.email as customer_email, c.company_name as customer_company,
        c.user_id as customer_user_id
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    if (!rows[0]) return null;

    const row = rows[0];
    return {
      ...row,
      amount: parseFloat(row.amount) || 0,
      invoice_total: parseFloat(row.invoice_total) || 0,
      invoice_balance: parseFloat(row.invoice_balance) || 0
    };
  }

  /**
   * Find all payments for a specific invoice
   */
  static async findByInvoiceId(invoiceId) {
    const query = `
      SELECT 
        p.id, p.payment_number, p.invoice_id, p.customer_id,
        p.amount, p.currency, p.payment_method, p.transaction_reference,
        p.status,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
        p.notes, p.created_at,
        c.name as customer_name, c.email as customer_email
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      WHERE p.invoice_id = ?
      ORDER BY p.id DESC
    `;

    const [rows] = await pool.execute(query, [invoiceId]);
    return rows.map((r) => ({
      ...r,
      amount: parseFloat(r.amount) || 0
    }));
  }

  /**
   * Update payment status (e.g. pending -> completed, or completed -> refunded)
   */
  static async updateStatus(id, newStatus) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [payRows] = await connection.execute(
        `SELECT id, invoice_id, amount, status FROM payments WHERE id = ? FOR UPDATE`,
        [id]
      );

      if (!payRows[0]) {
        throw new Error(`Payment with ID ${id} not found.`);
      }

      const payment = payRows[0];
      const oldStatus = payment.status;
      const payAmount = parseFloat(payment.amount) || 0;

      if (oldStatus === newStatus) {
        await connection.commit();
        return true;
      }

      // 1. Fetch invoice to adjust balance
      const [invRows] = await connection.execute(
        `SELECT id, total, amount_paid, balance_due, status FROM invoices WHERE id = ? FOR UPDATE`,
        [payment.invoice_id]
      );

      if (invRows[0]) {
        const inv = invRows[0];
        let currentPaid = parseFloat(inv.amount_paid) || 0;
        let invTotal = parseFloat(inv.total) || 0;

        // Transition: pending -> completed
        if (oldStatus !== 'completed' && newStatus === 'completed') {
          currentPaid = Math.round((currentPaid + payAmount) * 100) / 100;
        } 
        // Transition: completed -> refunded or failed
        else if (oldStatus === 'completed' && (newStatus === 'refunded' || newStatus === 'failed')) {
          currentPaid = Math.max(0, Math.round((currentPaid - payAmount) * 100) / 100);
        }

        const newBalance = Math.max(0, Math.round((invTotal - currentPaid) * 100) / 100);
        let newInvStatus = inv.status;

        if (currentPaid >= invTotal && invTotal > 0) {
          newInvStatus = 'paid';
        } else if (currentPaid > 0) {
          newInvStatus = 'partially_paid';
        } else {
          newInvStatus = 'pending';
        }

        await connection.execute(
          `UPDATE invoices SET
            amount_paid = ?,
            balance_due = ?,
            amount_due = ?,
            status = ?,
            updated_at = NOW()
          WHERE id = ?`,
          [currentPaid, newBalance, newBalance, newInvStatus, payment.invoice_id]
        );
      }

      // 2. Update payment status
      await connection.execute(
        `UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?`,
        [newStatus, id]
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

module.exports = Payment;
