import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { StaffManagementPage } from './pages/admin/StaffManagementPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { SubscriptionsPage } from './pages/admin/SubscriptionsPage';
import { BillingPage } from './pages/admin/BillingPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { PlansPage } from './pages/admin/PlansPage';
import { CustomersPage } from './pages/admin/CustomersPage';
import { CustomerProfilePage } from './pages/admin/CustomerProfilePage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import api from './services/api';

export default function App() {
  const [backendHealth, setBackendHealth] = useState(null);
  const [backendStatus, setBackendStatus] = useState('connecting');

  const checkHealth = useCallback(async () => {
    try {
      setBackendStatus('connecting');
      const response = await api.get('/health');
      if (response.data && response.data.status === 'healthy') {
        setBackendHealth(response.data);
        setBackendStatus('healthy');
      } else {
        setBackendStatus('degraded');
      }
    } catch (err) {
      setBackendHealth({ status: 'offline', error: err.message });
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Root Layout & Auth Routes */}
          <Route element={<RootLayout backendStatus={backendStatus} />}>
            <Route
              path="/"
              element={
                <WelcomePage
                  backendHealth={backendHealth}
                  onRetryHealth={checkHealth}
                />
              }
            />

            {/* Authentication Flow Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>

          {/* Dedicated Authenticated Admin Portal with Sidebar & Header Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['admin', 'staff']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* Direct Core Module Routes */}
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerProfilePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="plans" element={<PlansPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'staff']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Overview */}
            <Route index element={<AdminDashboardPage />} />

            {/* Core Management Aliases */}
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerProfilePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="plans" element={<PlansPage />} />

            {/* Subscriptions Module */}
            <Route path="subscriptions" element={<SubscriptionsPage />} />

            {/* Billing & Invoices */}
            <Route path="billing" element={<BillingPage />} />

            {/* Staff Management (Admin only) */}
            <Route
              path="staff"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffManagementPage />
                </ProtectedRoute>
              }
            />

            {/* Platform Settings (Admin only) */}
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
