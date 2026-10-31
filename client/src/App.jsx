import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { WelcomePage } from './pages/WelcomePage';
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
            <Route
              path="/"
              element={
                <WelcomePage
                  backendHealth={backendHealth}
                  onRetryHealth={checkHealth}
                />
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
