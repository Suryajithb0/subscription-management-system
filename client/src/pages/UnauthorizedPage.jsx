import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const UnauthorizedPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
          Access Restricted
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Your current account role (<span className="text-indigo-400 font-semibold uppercase">{user?.role || 'Guest'}</span>) does not have sufficient administrative permissions to access this requested resource.
        </p>

        <div className="space-y-3">
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </Link>

          <Link
            to="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm border border-slate-700 transition"
          >
            <LogIn className="h-4 w-4" />
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  );
};
