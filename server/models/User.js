const { pool } = require('../config/db');

class User {
  /**
   * Find user by email (includes password_hash and role for authentication)
   */
  static async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role, status, reset_password_token, reset_password_expires, created_at, updated_at FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  /**
   * Find user by ID (excludes password_hash and reset tokens)
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find user by hashed reset token (only valid if unexpired)
   */
  static async findByResetToken(hashedToken) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, status, reset_password_expires FROM users WHERE reset_password_token = ? AND reset_password_expires > NOW()',
      [hashedToken]
    );
    return rows[0] || null;
  }

  /**
   * Create user account with role
   */
  static async create({ name, email, passwordHash, role = 'customer', status = 'active' }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
        [cleanName, cleanEmail, passwordHash, role, status]
      );
      const userId = result.insertId;

      // If registered as customer, link/create customer profile
      if (role === 'customer') {
        const nameParts = cleanName.split(/\s+/);
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        // Check if customer row already exists with this email
        const [existingCust] = await connection.execute(
          'SELECT id FROM customers WHERE email = ?',
          [cleanEmail]
        );

        if (existingCust.length > 0) {
          await connection.execute(
            'UPDATE customers SET user_id = ? WHERE id = ?',
            [userId, existingCust[0].id]
          );
        } else {
          await connection.execute(
            'INSERT INTO customers (user_id, first_name, last_name, email, country, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, firstName, lastName, cleanEmail, 'United States', 'USD', 'active']
          );
        }
      }

      await connection.commit();
      return userId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Store hashed password reset token and expiration
   */
  static async setResetToken(id, hashedToken, expiresAt) {
    const [result] = await pool.execute(
      'UPDATE users SET reset_password_token = ?, reset_password_expires = ?, updated_at = NOW() WHERE id = ?',
      [hashedToken, expiresAt, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Clear reset token after successful reset or expiration
   */
  static async clearResetToken(id) {
    const [result] = await pool.execute(
      'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Update user's password and clear any pending reset tokens
   */
  static async updatePassword(id, passwordHash) {
    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = ?',
      [passwordHash, id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Update account status (e.g. active, inactive, suspended)
   */
  static async updateStatus(id, status) {
    const [result] = await pool.execute(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = User;
