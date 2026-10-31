import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, LogOut, UserPlus, LogIn, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const Navbar = ({ backendStatus }) => {
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'admin':
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
            Admin
          </span>
        );
      case 'staff':
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
            Staff
          </span>
        );
      default:
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            Customer
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              SubSphere
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0.0
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation & Controls */}
        <div className="flex items-center space-x-4">
          {/* Health Status Indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === 'healthy'
                  ? 'bg-emerald-400 animate-pulse'
                  : backendStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              API: {backendStatus === 'healthy' ? 'Online' : backendStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>

          {/* If Logged In */}
          {isAuthenticated && user ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition font-medium"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </Link>

              {isAdmin && (
                <Link
                  to="/admin/staff"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition"
                >
                  <Users className="h-3.5 w-3.5" />
                  Manage Staff
                </Link>
              )}

              <div className="flex items-center space-x-2.5 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white leading-tight">
                    {user.name}
                  </span>
                  <div className="mt-0.5">{getRoleBadge(user.role)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign Out"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            /* If Guest */
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>

              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/20 transition"
              >
                <UserPlus className="h-4 w-4" />
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
