import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  LifeBuoy,
  Bell,
  Sparkles
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Overview',
      path: '/admin',
      icon: LayoutDashboard,
      exact: true,
      roles: ['admin', 'staff', 'customer']
    },
    {
      name: 'Customers',
      path: '/customers',
      icon: Users,
      roles: ['admin', 'staff']
    },
    {
      name: 'Products & Catalog',
      path: '/products',
      icon: Package,
      roles: ['admin', 'staff']
    },
    {
      name: 'Plans & Pricing',
      path: '/plans',
      icon: Layers,
      roles: ['admin', 'staff']
    },
    {
      name: 'Staff Management',
      path: '/admin/staff',
      icon: Shield,
      roles: ['admin']
    },
    {
      name: 'Subscriptions',
      path: '/admin/subscriptions',
      icon: CreditCard,
      roles: ['admin', 'staff']
    },
    {
      name: 'Transactions & Billing',
      path: '/admin/billing',
      icon: CreditCard,
      roles: ['admin', 'staff']
    },
    {
      name: 'System Settings',
      path: '/admin/settings',
      icon: Settings,
      roles: ['admin']
    }
  ];

  // Filter items based on user role
  const userRole = user?.role || 'customer';
  const filteredNavItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0b0d1e]/95 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 ease-in-out lg:static ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          <NavLink
            to="/"
            className={`flex items-center gap-3 transition-opacity ${
              isCollapsed ? 'justify-center w-full' : ''
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <div className="h-full w-full bg-[#0d0f24] rounded-[10px] flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                  SubFlow
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-400">
                  Management
                </span>
              </div>
            )}
          </NavLink>

          {/* Collapse toggle button on desktop */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* User preview snippet */}
        <div className="p-3 border-b border-slate-800/40">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/40 border border-slate-800/50">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-medium text-slate-400 capitalize">{user?.role || 'Admin'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
          <div className={`px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
            {isCollapsed ? '•••' : 'Main Menu'}
          </div>

          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!isCollapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <button
            onClick={handleLogout}
            title={isCollapsed ? 'Log Out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20 ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
