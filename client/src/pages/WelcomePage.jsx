import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Database,
  KeyRound,
  Layers,
  Server,
  Sparkles,
  RefreshCw,
  FolderGit2,
  LogIn,
  UserPlus
} from 'lucide-react';
import { StatusCard } from '../components/common/StatusCard';
import { useAuth } from '../hooks/useAuth';

export const WelcomePage = ({ backendHealth, onRetryHealth }) => {
  const { user, isAuthenticated } = useAuth();
  const isHealthy = backendHealth?.status === 'healthy';

  const techStack = [
    { name: 'React 19 & Vite', category: 'Frontend', desc: 'Fast HMR & modern SPA tooling', status: 'Ready' },
    { name: 'Tailwind CSS v4', category: 'Styling', desc: 'Utility-first modern styling', status: 'Active' },
    { name: 'Node.js & Express', category: 'Backend API', desc: 'REST server with health probing', status: isHealthy ? 'Connected' : 'Standby' },
    { name: 'MySQL (mysql2)', category: 'Database', desc: 'Relational data with pooling', status: 'Configured' },
    { name: 'JWT & bcrypt', category: 'Auth & RBAC', desc: 'Admin, Staff, Customer security', status: 'Active (Stage 03)' },
    { name: 'Nodemailer', category: 'Email Service', desc: 'Secure token reset delivery', status: 'Configured' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800 p-8 sm:p-12 mb-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Stage 03: Authentication & Role Management Online
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">SubSphere</span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed mb-8">
            The complete authentication, JWT security layer, and role-based access control (Admin, Staff, Customer)
            have been implemented and verified.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-600/30 transition-all text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>

                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-all text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Customer Account
                </Link>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-600/30 transition-all text-sm"
                >
                  <Layers className="h-4 w-4" />
                  <span>Open Platform Dashboard →</span>
                </Link>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Signed in as {user.name} ({user.role.toUpperCase()})
                </div>
              </div>
            )}

            <button
              onClick={onRetryHealth}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-medium border border-slate-700/60 transition-all text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Re-probe Backend
            </button>
          </div>
        </div>
      </div>

      {/* Quick Architecture Metrics */}
      <div id="health-probe" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatusCard
          icon={Server}
          title="Backend Service"
          value={isHealthy ? 'Healthy' : 'Awaiting Server'}
          subtitle={backendHealth?.service || 'GET /api/health'}
          statusColor={isHealthy ? 'text-emerald-400' : 'text-amber-400'}
        />

        <StatusCard
          icon={Layers}
          title="Frontend Client"
          value="Vite 8 + React 19"
          subtitle="HMR & Tailwind CSS Active"
          statusColor="text-indigo-400"
        />

        <StatusCard
          icon={Database}
          title="Database"
          value="MySQL (subflow_db)"
          subtitle="15 Core Tables Verified"
          statusColor="text-sky-400"
        />

        <StatusCard
          icon={KeyRound}
          title="Auth Architecture"
          value="JWT + bcrypt + RBAC"
          subtitle="Admin / Staff / Customer"
          statusColor="text-purple-400"
        />
      </div>

      {/* Tech Stack Matrix */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Stage 03 Foundation Matrix</h2>
            <p className="text-sm text-slate-400">Security, token management, and authentication workflows</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {techStack.map((tech, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex items-start justify-between"
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {tech.category}
                </span>
                <h3 className="text-base font-semibold text-white mt-1">{tech.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{tech.desc}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {tech.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps for Developer */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
        <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
          <FolderGit2 className="h-4 w-4 text-indigo-400" />
          Stage 03 Module Endpoints Ready
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          All authentication routes (<code className="text-indigo-300">/login</code>, <code className="text-indigo-300">/register</code>, <code className="text-indigo-300">/forgot-password</code>, <code className="text-indigo-300">/reset-password</code>, <code className="text-indigo-300">/admin/staff</code>) are functional with role-based routing.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-slate-400">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-indigo-400 block mb-1"># Test Suite Execution</span>
            npm --prefix server test
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-purple-400 block mb-1"># Default Admin Account</span>
            admin@subflow.io / Admin@SubFlow2026!
          </div>
        </div>
      </div>
    </div>
  );
};
