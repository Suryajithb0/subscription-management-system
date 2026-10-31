const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

/**
 * Generate JWT access token with payload { id, email, role }
 */
const generateAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET || 'fallback_subflow_secret_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role || 'customer'
    },
    secret,
    { expiresIn }
  );
};

/**
 * Verify JWT access token
 */
const verifyAccessToken = (token) => {
  const secret = process.env.JWT_SECRET || 'fallback_subflow_secret_key';
  return jwt.verify(token, secret);
};

/**
 * Generate cryptographically secure random token (64 hex characters)
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash reset token using SHA-256 for secure database storage
 */
const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Get expiration date for reset token (defaults to 1 hour from current time)
 */
const getResetTokenExpiry = (hours = 1) => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
};

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateResetToken,
  hashResetToken,
  getResetTokenExpiry
};
