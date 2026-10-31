import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';

export const AdminLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Dynamic header title lookup based on path
  const getHeaderTitle = (pathname) => {
    if (pathname === '/admin' || pathname === '/admin/') return 'Dashboard Overview';
    if (pathname.startsWith('/admin/staff')) return 'Staff & Role Management';
    if (pathname.startsWith('/admin/subscriptions')) return 'Subscription Management';
    if (pathname.startsWith('/admin/billing')) return 'Billing & Transactions';
    if (pathname.startsWith('/admin/settings')) return 'System Settings';
    return 'Admin Portal';
  };

  return (
    <div className="min-h-screen bg-[#070814] text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-violet-600/10 rounded-full blur-[130px]" />
      </div>

      <div className="flex-1 flex w-full relative z-10">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />

        {/* Content area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <Header
            onOpenMobileSidebar={() => setIsMobileOpen(true)}
            title={getHeaderTitle(location.pathname)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
