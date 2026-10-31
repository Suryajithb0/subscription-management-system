const { pool } = require('../config/db');

class Analytics {
  /**
   * Fetch complete real-time database analytics for dashboard
   */
  static async getDashboardAnalytics(userId = null) {
    let customerFilter = '';
    let customerParams = [];

    // Role Scoping for customer role
    if (userId) {
      customerFilter = 'WHERE c.user_id = ?';
      customerParams.push(userId);
    }

    // 1. Summary Cards Metrics
    const [revRows] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_collected_revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments_count,
        COUNT(p.id) as total_payments_count
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      ${customerFilter}
    `, customerParams);

    const [invRows] = await pool.execute(`
      SELECT 
        COUNT(i.id) as total_invoices_count,
        SUM(CASE WHEN i.status IN ('pending', 'open') THEN 1 ELSE 0 END) as pending_invoices_count,
        SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices_count,
        SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_invoices_count,
        COALESCE(SUM(i.total), 0) as total_invoiced_volume,
        COALESCE(SUM(i.balance_due), 0) as total_outstanding_balance
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${customerFilter}
    `, customerParams);

    const [subRows] = await pool.execute(`
      SELECT 
        COUNT(s.id) as total_subscriptions_count,
        SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_subscriptions_count,
        SUM(CASE WHEN s.status = 'paused' THEN 1 ELSE 0 END) as paused_subscriptions_count,
        SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_subscriptions_count,
        SUM(CASE WHEN s.status = 'draft' THEN 1 ELSE 0 END) as draft_subscriptions_count
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      ${customerFilter}
    `, customerParams);

    // Global counts (for admin/staff)
    const [custRows] = await pool.execute('SELECT COUNT(*) as total_customers FROM customers WHERE status = "active"');
    const [prodRows] = await pool.execute('SELECT COUNT(*) as total_products FROM products WHERE is_active = 1');

    // 2. Monthly Revenue Chart (Actual completed payments grouped by month)
    const [monthlyRevRows] = await pool.execute(`
      SELECT 
        DATE_FORMAT(p.payment_date, '%b %Y') as month,
        DATE_FORMAT(p.payment_date, '%Y-%m') as sort_key,
        COALESCE(SUM(p.amount), 0) as revenue,
        COUNT(p.id) as transaction_count
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      ${userId ? 'WHERE c.user_id = ? AND p.status = "completed"' : 'WHERE p.status = "completed"'}
      GROUP BY sort_key, month
      ORDER BY sort_key ASC
      LIMIT 12
    `, userId ? [userId] : []);

    // 3. Subscription Status Distribution Chart
    const [subDistRows] = await pool.execute(`
      SELECT 
        s.status as name,
        COUNT(s.id) as value
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      ${customerFilter}
      GROUP BY s.status
      ORDER BY value DESC
    `, customerParams);

    // Format status distribution with capitalization
    const formattedSubDist = subDistRows.map(r => ({
      name: r.name ? r.name.charAt(0).toUpperCase() + r.name.slice(1) : 'Unknown',
      value: parseInt(r.value, 10)
    }));

    // 4. Payments by Method Chart
    const [payMethodRows] = await pool.execute(`
      SELECT 
        p.payment_method,
        COUNT(p.id) as count,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as collected_amount,
        COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as pending_amount
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      ${customerFilter}
      GROUP BY p.payment_method
    `, customerParams);

    const formattedPaymentMethods = payMethodRows.map(r => {
      const labels = {
        credit_card: 'Credit Card',
        card: 'Card',
        bank_transfer: 'Bank Transfer',
        upi: 'UPI',
        cash: 'Cash',
        paypal: 'PayPal',
        other: 'Other'
      };
      return {
        method: labels[r.payment_method] || r.payment_method,
        name: labels[r.payment_method] || r.payment_method,
        count: parseInt(r.count, 10),
        collected: parseFloat(r.collected_amount),
        pending: parseFloat(r.pending_amount),
        value: parseFloat(r.collected_amount)
      };
    });

    // 5. Invoice Status Distribution
    const [invStatusRows] = await pool.execute(`
      SELECT 
        i.status as name,
        COUNT(i.id) as value,
        COALESCE(SUM(i.total), 0) as total_amount
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${customerFilter}
      GROUP BY i.status
    `, customerParams);

    const formattedInvStatus = invStatusRows.map(r => ({
      name: r.name ? r.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown',
      value: parseInt(r.value, 10),
      amount: parseFloat(r.total_amount)
    }));

    // 6. Recent Payments (Last 5)
    const [recentPayments] = await pool.execute(`
      SELECT 
        p.id, p.payment_number, p.amount, p.payment_method, p.status,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
        i.invoice_number,
        c.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      ${customerFilter}
      ORDER BY p.id DESC
      LIMIT 5
    `, customerParams);

    // 7. Recent Invoices (Last 5)
    const [recentInvoices] = await pool.execute(`
      SELECT 
        i.id, i.invoice_number, i.total, i.balance_due, i.status,
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') as issue_date,
        c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ${customerFilter}
      ORDER BY i.id DESC
      LIMIT 5
    `, customerParams);

    // 8. Recent Subscriptions (Last 5)
    const [recentSubscriptions] = await pool.execute(`
      SELECT 
        s.id, s.subscription_number, s.status, s.billing_cycle, s.total_amount,
        DATE_FORMAT(s.start_date, '%Y-%m-%d') as start_date,
        c.name as customer_name,
        pl.name as plan_name
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans pl ON s.plan_id = pl.id
      ${customerFilter}
      ORDER BY s.id DESC
      LIMIT 5
    `, customerParams);

    // 9. Recent Failed Payments
    const [failedPayments] = await pool.execute(`
      SELECT 
        p.id, p.payment_number, p.amount, p.payment_method,
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') as payment_date,
        i.invoice_number,
        c.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON p.customer_id = c.id
      ${userId ? 'WHERE c.user_id = ? AND p.status = "failed"' : 'WHERE p.status = "failed"'}
      ORDER BY p.id DESC
      LIMIT 5
    `, userId ? [userId] : []);

    // 10. Expiring / Renewing Soon Subscriptions
    const [expiringSubs] = await pool.execute(`
      SELECT 
        s.id, s.subscription_number, s.status, s.total_amount,
        DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') as next_billing_date,
        DATE_FORMAT(s.end_date, '%Y-%m-%d') as end_date,
        c.name as customer_name,
        pl.name as plan_name
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans pl ON s.plan_id = pl.id
      WHERE s.status = 'active'
        ${userId ? 'AND c.user_id = ?' : ''}
        AND s.next_billing_date IS NOT NULL
        AND s.next_billing_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)
      ORDER BY s.next_billing_date ASC
      LIMIT 5
    `, userId ? [userId] : []);

    return {
      summary: {
        totalRevenue: parseFloat(revRows[0].total_collected_revenue || 0),
        collectedRevenue: parseFloat(revRows[0].total_collected_revenue || 0),
        invoicedRevenue: parseFloat(invRows[0].total_invoiced_volume || 0),
        invoicedVolume: parseFloat(invRows[0].total_invoiced_volume || 0),
        outstandingBalance: parseFloat(invRows[0].total_outstanding_balance || 0),
        outstandingBalances: parseFloat(invRows[0].total_outstanding_balance || 0),
        totalCustomers: parseInt(custRows[0].total_customers, 10) || 0,
        activeSubscriptions: parseInt(subRows[0].active_subscriptions_count, 10) || 0,
        totalSubscriptions: parseInt(subRows[0].total_subscriptions_count, 10) || 0,
        totalProducts: parseInt(prodRows[0].total_products, 10) || 0,
        totalInvoices: parseInt(invRows[0].total_invoices_count, 10) || 0,
        pendingInvoices: parseInt(invRows[0].pending_invoices_count, 10) || 0,
        overdueInvoices: parseInt(invRows[0].overdue_invoices_count, 10) || 0,
        paidInvoices: parseInt(invRows[0].paid_invoices_count, 10) || 0,
        totalPayments: parseInt(revRows[0].total_payments_count, 10) || 0,
        completedPayments: parseInt(revRows[0].completed_payments_count, 10) || 0,
        failedPaymentsCount: failedPayments.length
      },
      charts: {
        monthlyRevenue: monthlyRevRows.map(r => ({
          month: r.month,
          revenue: parseFloat(r.revenue),
          count: parseInt(r.transaction_count, 10)
        })),
        subscriptionStatusDistribution: formattedSubDist,
        paymentMethods: formattedPaymentMethods,
        invoiceStatusDistribution: formattedInvStatus
      },
      recent: {
        payments: recentPayments.map(p => ({
          ...p,
          amount: parseFloat(p.amount)
        })),
        invoices: recentInvoices.map(i => ({
          ...i,
          total: parseFloat(i.total),
          balance_due: parseFloat(i.balance_due)
        })),
        subscriptions: recentSubscriptions.map(s => ({
          ...s,
          total_amount: parseFloat(s.total_amount)
        })),
        failedPayments: failedPayments.map(p => ({
          ...p,
          amount: parseFloat(p.amount)
        })),
        expiringSubscriptions: expiringSubs.map(s => ({
          ...s,
          total_amount: parseFloat(s.total_amount)
        }))
      },
      recentActivity: {
        recentPayments: recentPayments.map(p => ({
          ...p,
          amount: parseFloat(p.amount)
        })),
        recentInvoices: recentInvoices.map(i => ({
          ...i,
          total: parseFloat(i.total),
          balance_due: parseFloat(i.balance_due)
        })),
        recentSubscriptions: recentSubscriptions.map(s => ({
          ...s,
          total_amount: parseFloat(s.total_amount)
        }))
      },
      additional: {
        outstandingInvoices: recentInvoices.filter(i => parseFloat(i.balance_due) > 0),
        recentFailedPayments: failedPayments.map(p => ({
          ...p,
          amount: parseFloat(p.amount)
        })),
        expiringSubscriptions: expiringSubs.map(s => ({
          ...s,
          total_amount: parseFloat(s.total_amount)
        }))
      }
    };
  }
}

module.exports = Analytics;
