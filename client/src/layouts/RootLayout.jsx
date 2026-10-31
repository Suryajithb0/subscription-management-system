import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';

export const RootLayout = ({ backendStatus }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar backendStatus={backendStatus} />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-600">
        SubSphere • Subscription Management Platform • Built with React, Vite, Tailwind CSS, Express & MySQL
      </footer>
    </div>
  );
};
