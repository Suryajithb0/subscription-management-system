import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { StaffManagementPage } from './pages/admin/StaffManagementPage';
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
          <Route element={<RootLayout backendStatus={backendStatus} />}>
            {/* Public Landing Page */}
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

            {/* Access Control & RBAC Protected Routes */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffManagementPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
