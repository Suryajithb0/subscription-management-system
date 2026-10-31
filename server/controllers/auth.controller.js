const bcrypt = require('bcrypt');
const User = require('../models/User');
const { validatePassword, validateEmail } = require('../utils/passwordValidation');
const {
  generateAccessToken,
  generateResetToken,
  hashResetToken,
  getResetTokenExpiry
} = require('../utils/tokenUtils');
const { sendPasswordResetEmail } = require('../utils/emailService');

const SALT_ROUNDS = 10;

/**
 * Standard cookie configuration for HTTP-only JWT storage
 */
const getAuthCookieOptions = () => ({
  httpOnly: true, // Prevents XSS / client script access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // CSRF mitigation
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

/**
 * Customer Registration
 * POST /api/auth/register
 * 
 * Auto-assigns 'customer' role. Public registration never allows selecting role.
 * Sets secure HTTP-only cookie.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required.'
      });
    }

    // 2. Validate password confirmation
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match.'
      });
    }

    // 3. Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    // 4. Validate password complexity (>8 chars, uppercase, lowercase, special char)
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message
      });
    }

    // 5. Check if email already registered
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    // 6. Hash password using bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 7. Enforce customer role automatically (ignore any role passed in body)
    const userId = await User.create({
      name,
      email,
      passwordHash,
      role: 'customer',
      status: 'active'
    });

    // 8. Generate JWT access token
    const token = generateAccessToken({
      id: userId,
      email: email.toLowerCase().trim(),
      role: 'customer'
    });

    // 9. Set HTTP-only session cookie
    res.cookie('subflow_token', token, getAuthCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Customer account created.',
      data: {
        user: {
          id: userId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: 'customer'
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Universal Login (Admin, Staff, Customer)
 * POST /api/auth/login
 * 
 * Sets secure HTTP-only cookie.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Handle inactive / suspended accounts
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${user.status}. Please contact an administrator.`
      });
    }

    // Generate JWT access token
    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Set secure HTTP-only cookie
    res.cookie('subflow_token', token, getAuthCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout
 * POST /api/auth/logout
 * 
 * Clears the HTTP-only cookie.
 */
const logout = async (req, res) => {
  res.clearCookie('subflow_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

/**
 * Staff Account Management (Admin only)
 * POST /api/auth/staff/create
 */
const createStaff = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Staff name, email, and password are required.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message
      });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const staffId = await User.create({
      name,
      email,
      passwordHash,
      role: 'staff',
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Staff account created successfully.',
      data: {
        user: {
          id: staffId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role: 'staff'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Password Reset - Request Token
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const user = await User.findByEmail(email);

    // If user exists and is active, create reset token
    if (user && user.status === 'active') {
      const resetToken = generateResetToken();
      const hashedToken = hashResetToken(resetToken);
      const expiresAt = getResetTokenExpiry(1); // 1 hour expiration

      await User.setResetToken(user.id, hashedToken, expiresAt);

      const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
      const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

      // Dispatch email via Nodemailer
      await sendPasswordResetEmail({
        to: user.email,
        resetToken,
        resetUrl
      });
    }

    // Security requirement: Always return uniform message to avoid revealing email registration
    return res.status(200).json({
      success: true,
      message: 'If that email address is registered, password reset instructions have been sent.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Password Reset - Execute Reset with Token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required.'
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match.'
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message
      });
    }

    // Hash incoming token and look up active unexpired token
    const hashedToken = hashResetToken(token);
    const user = await User.findByResetToken(hashedToken);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.'
      });
    }

    // Hash new password and update user (clearing reset token to prevent reuse)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await User.updatePassword(user.id, passwordHash);

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Authenticated Profile
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer Specific Resource Access (demonstrating customer ownership check)
 * GET /api/auth/customer/:customerId/profile
 */
const getCustomerProfile = async (req, res, next) => {
  try {
    const targetUserId = req.params.customerId;
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  createStaff,
  forgotPassword,
  resetPassword,
  getMe,
  getCustomerProfile
};
