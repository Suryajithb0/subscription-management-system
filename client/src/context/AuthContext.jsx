import React, { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session via HTTP-only cookie sent automatically by browser
  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data && response.data.success) {
        setUser(response.data.data);
      } else {
        setUser(null);
      }
    } catch {
      // 401 unauthenticated - user is not logged in or cookie expired
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Login handler - HTTP-only cookie set by server response
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data?.success && response.data?.data) {
      setUser(response.data.data.user);
      return response.data;
    }
    throw new Error(response.data?.message || 'Login failed.');
  };

  // Customer registration handler - HTTP-only cookie set by server response
  const register = async ({ name, email, password, confirmPassword }) => {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      confirmPassword
    });
    if (response.data?.success && response.data?.data) {
      setUser(response.data.data.user);
      return response.data;
    }
    throw new Error(response.data?.message || 'Registration failed.');
  };

  // Staff creation handler (Admin only)
  const createStaff = async ({ name, email, password }) => {
    const response = await api.post('/auth/staff/create', { name, email, password });
    return response.data;
  };

  // Forgot password request
  const forgotPassword = async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  };

  // Password reset execution
  const resetPassword = async ({ token: resetToken, password, confirmPassword }) => {
    const response = await api.post('/auth/reset-password', {
      token: resetToken,
      password,
      confirmPassword
    });
    return response.data;
  };

  // Logout handler - clears HTTP-only cookie on server and user in state
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue cleanup even if network fails
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    role: user?.role || null,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isCustomer: user?.role === 'customer',
    login,
    register,
    createStaff,
    forgotPassword,
    resetPassword,
    logout,
    refreshProfile: fetchCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
