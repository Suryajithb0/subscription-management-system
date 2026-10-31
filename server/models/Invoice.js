const { pool } = require('../config/db');
const Subscription = require('./Subscription');

class Invoice {
  /**
   * Generate a guaranteed unique, human-friendly invoice number
   * Format: INV-YYYYMM-XXXX
   */
  static async generateInvoiceNumber(connection = null) {
    const executor = connection || pool;
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `INV-${yearMonth}-`;

    const [rows] = await executor.execute(
      `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNum = 1001;
    if (rows.length > 0 && rows[0].invoice_number) {
      const parts = rows[0].invoice_number.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }

    let candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
    
    // Safety check for uniqueness
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await executor.execute(
        `SELECT id FROM invoices WHERE invoice_number = ?`,
        [candidate]
      );
      if (existing.length === 0) {
        return candidate;
      }
      nextNum += 1;
      candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
      attempts++;
    }

    // Fallback with timestamp randomness
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }

  /**
   * Find single invoice by ID with customer, subscription, and line items
   */
  static async findById(id) {
    const query = `
      SELECT 
        i.id, i.invoice_number, i.customer_id, i.subscription_id,
        DATE_FORMAT(i.billing_period_start, '%Y-%m-%d') as billing_period_start,
        DATE_FORMAT(i.billing_period_end, '%Y-%m-%d') as billing_period_end,
        i.billing_period,
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') as issue_date,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') as due_date,
        i.paid_at,
        i.subtotal, i.tax_total, i.tax_amount,
        i.discount_total, i.discount_amount,
        i.total, i.amount_paid, i.amount_due, i.balance_due,
        i.currency, i.status, i.notes,
        i.created_at, i.updated_at,
        c.name as customer_name,
        c.first_name, c.last_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name as customer_company,
        c.billing_address, c.address as customer_address,
        c.city as customer_city, c.state as customer_state,
        c.postal_code as customer_postal_code,
        c.country as customer_country,
        c.tax_id as customer_tax_id,
        c.user_id as customer_user_id,
        s.subscription_number,
        s.billing_cycle as subscription_billing_cycle,
        s.status as subscription_status
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      WHERE i.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    if (!rows[0]) return null;

    const invoice = rows[0];

    // Fetch line items with tax info
    const itemsQuery = `
      SELECT 
        ii.id, ii.invoice_id, ii.subscription_item_id,
        ii.description, ii.quantity, ii.unit_price,
        ii.discount_amount, ii.tax_id, ii.tax_rate,
        ii.tax_amount, ii.line_total,
        t.name as tax_name, t.rate as tax_def_rate
      FROM invoice_items ii
      LEFT JOIN taxes t ON ii.tax_id = t.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id ASC
    `;
    const [items] = await pool.execute(itemsQuery, [id]);

    const formattedItems = items.map((item) => ({
      id: item.id,
      invoice_id: item.invoice_id,
      subscription_item_id: item.subscription_item_id,
      description: item.description,
      quantity: parseInt(item.quantity, 10) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      discount_amount: parseFloat(item.discount_amount) || 0,
      tax_id: item.tax_id,
      tax_name: item.tax_name || null,
      tax_rate: parseFloat(item.tax_rate ?? item.tax_def_rate ?? 0),
      tax_amount: parseFloat(item.tax_amount) || 0,
      line_total: parseFloat(item.line_total) || 0
    }));

    return {
      ...invoice,
      subtotal: parseFloat(invoice.subtotal) || 0,
      tax_total: parseFloat(invoice.tax_total ?? invoice.tax_amount ?? 0),
      tax_amount: parseFloat(invoice.tax_amount ?? invoice.tax_total ?? 0),
      discount_total: parseFloat(invoice.discount_total ?? invoice.discount_amount ?? 0),
      discount_amount: parseFloat(invoice.discount_amount ?? invoice.discount_total ?? 0),
      total: parseFloat(invoice.total) || 0,
      amount_paid: parseFloat(invoice.amount_paid) || 0,
      amount_due: parseFloat(invoice.amount_due ?? invoice.balance_due ?? 0),
      balance_due: parseFloat(invoice.balance_due ?? invoice.amount_due ?? 0),
      items: formattedItems
    };
  }

  /**
   * Find all invoices with search, filters, pagination, and role scoping
   */
  static async findAll({
    search = '',
    status = '',
    customer_id = '',
    userId = null,
    page = 1,
    limit = 10
  }) {
    let whereClauses = [];
    let params = [];

    // Role Scoping: Customers can only access their own invoices
    if (userId) {
      whereClauses.push('c.user_id = ?');
      params.push(userId);
    }

    if (search && search.trim() !== '') {
      whereClauses.push('(i.invoice_number LIKE ? OR c.name LIKE ? OR c.email LIKE ? OR c.company_name LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      whereClauses.push('i.status = ?');
      params.push(status.trim());
    }

    if (customer_id && customer_id !== 'all') {
      whereClauses.push('i.customer_id = ?');
      params.push(parseInt(customer_id, 10));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${whereSql}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    // Summary metrics query
    let metricsWhere = '';
    let metricsParams = [];
    if (userId) {
      metricsWhere = 'WHERE c.user_id = ?';
      metricsParams.push(userId);
    }

    const [metricRows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN i.status IN ('pending', 'open') THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN i.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        COALESCE(SUM(i.total), 0) as total_volume,
        COALESCE(SUM(i.amount_paid), 0) as total_collected,
        COALESCE(SUM(i.balance_due), 0) as total_outstanding
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${metricsWhere}
    `, metricsParams);

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (safePage - 1) * safeLimit;

    const dataQuery = `
      SELECT 
        i.id, i.invoice_number, i.customer_id, i.subscription_id,
        DATE_FORMAT(i.billing_period_start, '%Y-%m-%d') as billing_period_start,
        DATE_FORMAT(i.billing_period_end, '%Y-%m-%d') as billing_period_end,
        i.billing_period,
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') as issue_date,
        DATE_FORMAT(i.due_date, '%Y-%m-%d') as due_date,
        i.paid_at,
        i.subtotal, i.tax_total, i.tax_amount,
        i.discount_total, i.discount_amount,
        i.total, i.amount_paid, i.amount_due, i.balance_due,
        i.currency, i.status, i.notes,
        i.created_at, i.updated_at,
        c.name as customer_name, c.email as customer_email,
        c.company_name as customer_company,
        s.subscription_number
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN subscriptions s ON i.subscription_id = s.id
      ${whereSql}
      ORDER BY i.id DESC
      LIMIT ${Number(safeLimit)} OFFSET ${Number(offset)}
    `;

    const [rows] = await pool.execute(dataQuery, params);

    const formatted = rows.map((r) => ({
      ...r,
      subtotal: parseFloat(r.subtotal) || 0,
      tax_amount: parseFloat(r.tax_amount ?? r.tax_total ?? 0),
      discount_amount: parseFloat(r.discount_amount ?? r.discount_total ?? 0),
      total: parseFloat(r.total) || 0,
      amount_paid: parseFloat(r.amount_paid) || 0,
      balance_due: parseFloat(r.balance_due ?? r.amount_due ?? 0)
    }));

    return {
      invoices: formatted,
      metrics: {
        total: metricRows[0].total_count || 0,
        paid: metricRows[0].paid_count || 0,
        pending: metricRows[0].pending_count || 0,
        overdue: metricRows[0].overdue_count || 0,
        draft: metricRows[0].draft_count || 0,
        totalVolume: parseFloat(metricRows[0].total_volume || 0),
        totalCollected: parseFloat(metricRows[0].total_collected || 0),
        totalOutstanding: parseFloat(metricRows[0].total_outstanding || 0)
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
   * Create a manual invoice with line items
   */
  static async create({
    customer_id,
    subscription_id = null,
    issue_date,
    due_date,
    billing_period_start = null,
    billing_period_end = null,
    billing_period = null,
    notes = null,
    status = 'draft',
    currency = 'USD',
    amount_paid = 0,
    items = []
  }) {
    if (!items || items.length === 0) {
      throw new Error('Invoice must contain at least one line item.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Verify Customer exists
      const [cust] = await connection.execute(
        'SELECT id, currency FROM customers WHERE id = ?',
        [customer_id]
      );
      if (!cust[0]) {
        throw new Error(`Customer with ID ${customer_id} does not exist.`);
      }

      // 2. Load taxes for server-side verification
      const [allTaxes] = await connection.execute('SELECT id, rate, is_active FROM taxes');
      const taxMap = new Map();
      allTaxes.forEach(t => taxMap.set(t.id, parseFloat(t.rate)));

      // 3. Process line items and calculate backend-verified amounts
      let calculatedSubtotal = 0;
      let calculatedDiscountTotal = 0;
      let calculatedTaxTotal = 0;

      const processedItems = [];

      for (const item of items) {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPrice = Math.max(0, parseFloat(item.unit_price) || 0);
        const discountAmount = Math.max(0, parseFloat(item.discount_amount) || 0);

        let taxId = item.tax_id ? parseInt(item.tax_id, 10) : null;
        let taxRate = 0;

        if (taxId && taxMap.has(taxId)) {
          taxRate = taxMap.get(taxId);
        } else if (item.tax_rate !== undefined && item.tax_rate !== null) {
          taxRate = Math.max(0, parseFloat(item.tax_rate) || 0);
        }

        const rawTotal = qty * unitPrice;
        const netBase = Math.max(0, rawTotal - discountAmount);
        const itemTax = Math.round(netBase * taxRate * 100) / 100;
        const lineTotal = netBase + itemTax;

        calculatedSubtotal += rawTotal;
        calculatedDiscountTotal += discountAmount;
        calculatedTaxTotal += itemTax;

        processedItems.push({
          description: (item.description || 'Service Charge').trim(),
          quantity: qty,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          tax_id: taxId,
          tax_rate: taxRate,
          tax_amount: itemTax,
          line_total: lineTotal,
          subscription_item_id: item.subscription_item_id || null
        });
      }

      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
      calculatedDiscountTotal = Math.round(calculatedDiscountTotal * 100) / 100;
      calculatedTaxTotal = Math.round(calculatedTaxTotal * 100) / 100;

      const calculatedTotal = Math.round((calculatedSubtotal - calculatedDiscountTotal + calculatedTaxTotal) * 100) / 100;
      const safeAmountPaid = Math.max(0, Math.min(calculatedTotal, parseFloat(amount_paid) || 0));
      const calculatedBalanceDue = Math.round((calculatedTotal - safeAmountPaid) * 100) / 100;

      let finalStatus = status;
      if (safeAmountPaid >= calculatedTotal && calculatedTotal > 0) {
        finalStatus = 'paid';
      } else if (safeAmountPaid > 0) {
        finalStatus = 'partially_paid';
      }

      const invoiceNumber = await this.generateInvoiceNumber(connection);

      const [res] = await connection.execute(
        `INSERT INTO invoices (
          invoice_number, customer_id, subscription_id,
          billing_period_start, billing_period_end, billing_period,
          issue_date, due_date,
          subtotal, tax_total, tax_amount,
          discount_total, discount_amount,
          total, amount_paid, amount_due, balance_due,
          currency, status, notes,
          paid_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, NOW(), NOW()
        )`,
        [
          invoiceNumber,
          customer_id,
          subscription_id || null,
          billing_period_start || null,
          billing_period_end || null,
          billing_period || null,
          issue_date,
          due_date,
          calculatedSubtotal,
          calculatedTaxTotal,
          calculatedTaxTotal,
          calculatedDiscountTotal,
          calculatedDiscountTotal,
          calculatedTotal,
          safeAmountPaid,
          calculatedBalanceDue,
          calculatedBalanceDue,
          currency || 'USD',
          finalStatus,
          notes || null,
          finalStatus === 'paid' ? new Date() : null
        ]
      );

      const invoiceId = res.insertId;

      // Insert line items
      for (const pItem of processedItems) {
        await connection.execute(
          `INSERT INTO invoice_items (
            invoice_id, subscription_item_id, description,
            quantity, unit_price, discount_amount,
            tax_id, tax_rate, tax_amount, line_total,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            invoiceId,
            pItem.subscription_item_id,
            pItem.description,
            pItem.quantity,
            pItem.unit_price,
            pItem.discount_amount,
            pItem.tax_id,
            pItem.tax_rate,
            pItem.tax_amount,
            pItem.line_total
          ]
        );
      }

      await connection.commit();
      return invoiceId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Generate invoice from an active subscription
   */
  static async createFromSubscription(subscriptionId, options = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch Subscription details with Plan and Customer
      const subQuery = `
        SELECT 
          s.id, s.subscription_number, s.customer_id, s.plan_id,
          DATE_FORMAT(s.start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(s.end_date, '%Y-%m-%d') as end_date,
          DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') as next_billing_date,
          s.status, s.billing_cycle, s.quantity, s.unit_price, s.total_amount,
          s.currency, s.auto_renew,
          c.name as customer_name, c.email as customer_email,
          pl.name as plan_name, pl.price as plan_price,
          p.name as product_name
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN plans pl ON s.plan_id = pl.id
        JOIN products p ON pl.product_id = p.id
        WHERE s.id = ?
        FOR UPDATE
      `;
      const [subs] = await connection.execute(subQuery, [subscriptionId]);
      if (!subs[0]) {
        throw new Error(`Subscription with ID ${subscriptionId} not found.`);
      }

      const sub = subs[0];

      // Subscription status check: prevent creating for paused, cancelled, expired
      if (['paused', 'cancelled', 'expired'].includes(sub.status)) {
        throw new Error(`Cannot generate invoice for subscription with status '${sub.status}'.`);
      }

      // Determine period
      const issueDate = options.issue_date || new Date().toISOString().substring(0, 10);
      const periodStart = options.billing_period_start || sub.next_billing_date || sub.start_date || issueDate;
      const nextBillingDate = Subscription.calculateNextBillingDate(periodStart, sub.billing_cycle);
      
      // End date of this cycle is the day before the next cycle
      const [ny, nm, nd] = nextBillingDate.split('-').map(Number);
      const endD = new Date(Date.UTC(ny, nm - 1, nd));
      endD.setUTCDate(endD.getUTCDate() - 1);
      const periodEnd = options.billing_period_end || endD.toISOString().substring(0, 10);

      const periodDesc = `${periodStart} to ${periodEnd}`;

      // Due date (default: 14 days after issue)
      const [iy, im, id_] = issueDate.split('-').map(Number);
      const dueD = new Date(Date.UTC(iy, im - 1, id_));
      dueD.setUTCDate(dueD.getUTCDate() + 14);
      const dueDate = options.due_date || dueD.toISOString().substring(0, 10);

      // Duplicate prevention check: Check if an invoice already exists for this subscription & period
      const [existing] = await connection.execute(
        `SELECT id, invoice_number FROM invoices 
         WHERE subscription_id = ? AND billing_period_start = ? AND billing_period_end = ?`,
        [subscriptionId, periodStart, periodEnd]
      );
      if (existing.length > 0) {
        throw new Error(`An invoice (${existing[0].invoice_number}) has already been generated for this subscription for period ${periodDesc}.`);
      }

      // Check subscription item link if available
      const [subItems] = await connection.execute(
        `SELECT id FROM subscription_items WHERE subscription_id = ? LIMIT 1`,
        [subscriptionId]
      );
      const subItemId = subItems[0] ? subItems[0].id : null;

      // Item calculations
      const quantity = parseInt(sub.quantity, 10) || 1;
      const unitPrice = parseFloat(sub.plan_price || sub.unit_price) || 0;
      const subtotal = Math.round(quantity * unitPrice * 100) / 100;
      
      // Default tax for subscription (0 unless specified)
      const taxRate = options.tax_rate ? parseFloat(options.tax_rate) : 0;
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      const total = subtotal + taxAmount;

      const invoiceNumber = await this.generateInvoiceNumber(connection);

      const [res] = await connection.execute(
        `INSERT INTO invoices (
          invoice_number, customer_id, subscription_id,
          billing_period_start, billing_period_end, billing_period,
          issue_date, due_date,
          subtotal, tax_total, tax_amount,
          discount_total, discount_amount,
          total, amount_paid, amount_due, balance_due,
          currency, status, notes,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          0.00, 0.00,
          ?, 0.00, ?, ?,
          ?, 'pending', ?,
          NOW(), NOW()
        )`,
        [
          invoiceNumber,
          sub.customer_id,
          subscriptionId,
          periodStart,
          periodEnd,
          periodDesc,
          issueDate,
          dueDate,
          subtotal,
          taxAmount,
          taxAmount,
          total,
          total,
          total,
          sub.currency || 'USD',
          `Automated billing for ${sub.plan_name} (${sub.billing_cycle})`
        ]
      );

      const invoiceId = res.insertId;

      // Insert line item
      await connection.execute(
        `INSERT INTO invoice_items (
          invoice_id, subscription_item_id, description,
          quantity, unit_price, discount_amount,
          tax_id, tax_rate, tax_amount, line_total,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0.00, NULL, ?, ?, ?, NOW(), NOW())`,
        [
          invoiceId,
          subItemId,
          `${sub.product_name} - ${sub.plan_name} (${sub.billing_cycle}) [${periodDesc}]`,
          quantity,
          unitPrice,
          taxRate,
          taxAmount,
          total
        ]
      );

      // Advance next billing date on subscription
      if (options.advance_billing_date !== false) {
        await connection.execute(
          `UPDATE subscriptions 
           SET next_billing_date = ?, current_period_start = ?, current_period_end = ?, updated_at = NOW() 
           WHERE id = ?`,
          [nextBillingDate, periodStart, periodEnd, subscriptionId]
        );
      }

      await connection.commit();
      return invoiceId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Update an existing draft or pending invoice
   */
  static async update(id, {
    issue_date,
    due_date,
    billing_period,
    notes,
    items
  }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [invs] = await connection.execute(
        'SELECT id, status, customer_id, total, amount_paid FROM invoices WHERE id = ? FOR UPDATE',
        [id]
      );
      if (!invs[0]) {
        throw new Error(`Invoice with ID ${id} not found.`);
      }

      const inv = invs[0];
      if (['paid', 'cancelled', 'void'].includes(inv.status)) {
        throw new Error(`Cannot edit an invoice with status '${inv.status}'.`);
      }

      if (!items || items.length === 0) {
        throw new Error('Invoice must contain at least one line item.');
      }

      // Re-fetch tax records
      const [allTaxes] = await connection.execute('SELECT id, rate FROM taxes');
      const taxMap = new Map();
      allTaxes.forEach(t => taxMap.set(t.id, parseFloat(t.rate)));

      let calculatedSubtotal = 0;
      let calculatedDiscountTotal = 0;
      let calculatedTaxTotal = 0;

      const processedItems = [];

      for (const item of items) {
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPrice = Math.max(0, parseFloat(item.unit_price) || 0);
        const discountAmount = Math.max(0, parseFloat(item.discount_amount) || 0);

        let taxId = item.tax_id ? parseInt(item.tax_id, 10) : null;
        let taxRate = 0;

        if (taxId && taxMap.has(taxId)) {
          taxRate = taxMap.get(taxId);
        } else if (item.tax_rate !== undefined && item.tax_rate !== null) {
          taxRate = Math.max(0, parseFloat(item.tax_rate) || 0);
        }

        const rawTotal = qty * unitPrice;
        const netBase = Math.max(0, rawTotal - discountAmount);
        const itemTax = Math.round(netBase * taxRate * 100) / 100;
        const lineTotal = netBase + itemTax;

        calculatedSubtotal += rawTotal;
        calculatedDiscountTotal += discountAmount;
        calculatedTaxTotal += itemTax;

        processedItems.push({
          description: (item.description || 'Service Line Item').trim(),
          quantity: qty,
          unit_price: unitPrice,
          discount_amount: discountAmount,
          tax_id: taxId,
          tax_rate: taxRate,
          tax_amount: itemTax,
          line_total: lineTotal,
          subscription_item_id: item.subscription_item_id || null
        });
      }

      calculatedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
      calculatedDiscountTotal = Math.round(calculatedDiscountTotal * 100) / 100;
      calculatedTaxTotal = Math.round(calculatedTaxTotal * 100) / 100;
      const calculatedTotal = Math.round((calculatedSubtotal - calculatedDiscountTotal + calculatedTaxTotal) * 100) / 100;

      const currentAmountPaid = parseFloat(inv.amount_paid) || 0;
      const calculatedBalanceDue = Math.max(0, Math.round((calculatedTotal - currentAmountPaid) * 100) / 100);

      // Update invoice header
      await connection.execute(
        `UPDATE invoices SET
          issue_date = COALESCE(?, issue_date),
          due_date = COALESCE(?, due_date),
          billing_period = COALESCE(?, billing_period),
          notes = ?,
          subtotal = ?,
          tax_total = ?,
          tax_amount = ?,
          discount_total = ?,
          discount_amount = ?,
          total = ?,
          balance_due = ?,
          amount_due = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          issue_date || null,
          due_date || null,
          billing_period || null,
          notes || null,
          calculatedSubtotal,
          calculatedTaxTotal,
          calculatedTaxTotal,
          calculatedDiscountTotal,
          calculatedDiscountTotal,
          calculatedTotal,
          calculatedBalanceDue,
          calculatedBalanceDue,
          id
        ]
      );

      // Replace items
      await connection.execute('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

      for (const pItem of processedItems) {
        await connection.execute(
          `INSERT INTO invoice_items (
            invoice_id, subscription_item_id, description,
            quantity, unit_price, discount_amount,
            tax_id, tax_rate, tax_amount, line_total,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            pItem.subscription_item_id,
            pItem.description,
            pItem.quantity,
            pItem.unit_price,
            pItem.discount_amount,
            pItem.tax_id,
            pItem.tax_rate,
            pItem.tax_amount,
            pItem.line_total
          ]
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
   * Update invoice status with permitted transitions
   */
  static async updateStatus(id, newStatus, { amount_paid = null } = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [invs] = await connection.execute(
        'SELECT id, status, total, amount_paid FROM invoices WHERE id = ? FOR UPDATE',
        [id]
      );
      if (!invs[0]) {
        throw new Error(`Invoice with ID ${id} not found.`);
      }

      const inv = invs[0];
      const currentStatus = inv.status;
      const total = parseFloat(inv.total) || 0;

      // Status transition validation
      const ALLOWED_TRANSITIONS = {
        draft: ['pending', 'open', 'paid', 'cancelled'],
        open: ['pending', 'partially_paid', 'paid', 'overdue', 'cancelled'],
        pending: ['partially_paid', 'paid', 'overdue', 'cancelled'],
        partially_paid: ['paid', 'cancelled'],
        overdue: ['paid', 'partially_paid', 'cancelled'],
        paid: ['cancelled'],
        cancelled: [],
        void: []
      };

      if (currentStatus === newStatus) {
        await connection.commit();
        return true;
      }

      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'.`);
      }

      let finalPaid = parseFloat(inv.amount_paid) || 0;
      let paidAt = null;

      if (newStatus === 'paid') {
        finalPaid = total;
        paidAt = new Date();
      } else if (newStatus === 'partially_paid') {
        if (amount_paid !== null) {
          finalPaid = Math.max(0, Math.min(total, parseFloat(amount_paid) || 0));
        }
      } else if (newStatus === 'cancelled') {
        finalPaid = 0;
      }

      const balanceDue = Math.max(0, Math.round((total - finalPaid) * 100) / 100);

      await connection.execute(
        `UPDATE invoices SET
          status = ?,
          amount_paid = ?,
          balance_due = ?,
          amount_due = ?,
          paid_at = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [newStatus, finalPaid, balanceDue, balanceDue, paidAt, id]
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

  /**
   * Automated Recurring Billing Engine
   * Identifies all active subscriptions due for billing and generates invoices
   */
  static async processRecurringBilling() {
    const results = {
      processed: 0,
      invoicesGenerated: [],
      skipped: [],
      errors: []
    };

    try {
      // Find all active subscriptions whose next billing date is due (<= CURDATE())
      const [dueSubscriptions] = await pool.execute(`
        SELECT 
          s.id, s.subscription_number, s.customer_id, s.plan_id,
          DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') as next_billing_date,
          DATE_FORMAT(s.start_date, '%Y-%m-%d') as start_date,
          DATE_FORMAT(s.end_date, '%Y-%m-%d') as end_date,
          s.status, s.billing_cycle, s.quantity, s.unit_price, s.auto_renew,
          c.name as customer_name
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        WHERE s.status = 'active'
          AND s.auto_renew = 1
          AND s.next_billing_date IS NOT NULL
          AND s.next_billing_date <= CURDATE()
          AND (s.end_date IS NULL OR s.end_date >= CURDATE())
        ORDER BY s.next_billing_date ASC
      `);

      for (const sub of dueSubscriptions) {
        results.processed++;
        try {
          const invoiceId = await this.createFromSubscription(sub.id, {
            issue_date: sub.next_billing_date,
            advance_billing_date: true
          });

          const createdInvoice = await this.findById(invoiceId);
          results.invoicesGenerated.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.subscription_number,
            invoiceId: invoiceId,
            invoiceNumber: createdInvoice.invoice_number,
            customerName: sub.customer_name,
            total: createdInvoice.total,
            period: createdInvoice.billing_period
          });
        } catch (err) {
          if (err.message && err.message.includes('already been generated')) {
            results.skipped.push({
              subscriptionId: sub.id,
              subscriptionNumber: sub.subscription_number,
              reason: 'Invoice already exists for this billing period'
            });
          } else {
            results.errors.push({
              subscriptionId: sub.id,
              subscriptionNumber: sub.subscription_number,
              error: err.message
            });
          }
        }
      }

      return results;
    } catch (globalErr) {
      console.error('[Billing Engine] Global execution error:', globalErr);
      results.errors.push({ error: globalErr.message });
      return results;
    }
  }
}

module.exports = Invoice;
