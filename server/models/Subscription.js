const { pool } = require('../config/db');

class Subscription {
  static async findAllByUserId(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_renewal_date ASC',
      [userId]
    );
    return rows;
  }

  static async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return rows[0] || null;
  }

  static async create({ userId, serviceName, category, cost, currency, billingCycle, startDate, nextRenewalDate, paymentMethod }) {
    const [result] = await pool.execute(
      `INSERT INTO subscriptions 
        (user_id, service_name, category, cost, currency, billing_cycle, start_date, next_renewal_date, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, serviceName, category || 'General', cost, currency || 'USD', billingCycle || 'monthly', startDate, nextRenewalDate, paymentMethod || null]
    );
    return result.insertId;
  }

  static async update(id, userId, fields) {
    const allowed = ['service_name', 'category', 'cost', 'currency', 'billing_cycle', 'start_date', 'next_renewal_date', 'status', 'payment_method'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) return false;

    values.push(id, userId);
    const [result] = await pool.execute(
      `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  static async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Subscription;
