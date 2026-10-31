/**
 * Password & Email Validation Utilities
 * Enforces security constraints:
 * - More than 8 characters (> 8)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one special character
 */

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      message: 'Password is required and must be a string.'
    };
  }

  // Password must contain more than 8 characters (> 8 characters, i.e., length >= 9)
  if (password.length <= 8) {
    return {
      isValid: false,
      message: 'Password must contain more than 8 characters (at least 9 characters).'
    };
  }

  // At least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter.'
    };
  }

  // At least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter.'
    };
  }

  // At least one special character
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character (e.g., !@#$%^&*).'
    };
  }

  return {
    isValid: true,
    message: 'Password meets all security criteria.'
  };
};

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  // Standard compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

module.exports = {
  validatePassword,
  validateEmail
};
