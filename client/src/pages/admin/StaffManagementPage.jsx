import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Lock,
  User,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';

export const StaffManagementPage = () => {
  const { createStaff } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdStaffList, setCreatedStaffList] = useState([]);

  // Password requirements
  const checks = {
    length: password.length > 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };

  const allCriteriaMet =
    checks.length &&
    checks.uppercase &&
    checks.lowercase &&
    checks.special;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Staff full name, email, and password are required.');
      return;
    }

    if (!allCriteriaMet) {
      setError('Staff temporary password must meet all security requirements.');
      return;
    }

    try {
      setLoading(true);
      const res = await createStaff({
        name: name.trim(),
        email: email.trim(),
        password
      });

      setSuccess(`Staff account for ${res.data.user.name} (${res.data.user.email}) successfully provisioned!`);
      setCreatedStaffList((prev) => [res.data.user, ...prev]);

      // Clear fields
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to provision staff account.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Restricted Area
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Staff Account Provisioning
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create operational staff accounts with day-to-day management access.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Form Card */}
        <div className="md:col-span-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            Provision New Staff Member
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-300">{error}</div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-300">{success}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="staff-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Staff Full Name
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="staff-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Smith"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Staff Corporate Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="staff-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.smith@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label htmlFor="staff-password" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Initial Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Temporary password for staff"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block mb-1">Password Requirements:</span>
              <div className={`flex items-center gap-2 ${checks.length ? 'text-emerald-400' : 'text-slate-400'}`}>
                {checks.length ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-slate-600" />}
                <span>More than 8 characters (at least 9)</span>
              </div>
              <div className={`flex items-center gap-2 ${checks.uppercase ? 'text-emerald-400' : 'text-slate-400'}`}>
                {checks.uppercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-slate-600" />}
                <span>At least one uppercase letter (A-Z)</span>
              </div>
              <div className={`flex items-center gap-2 ${checks.lowercase ? 'text-emerald-400' : 'text-slate-400'}`}>
                {checks.lowercase ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-slate-600" />}
                <span>At least one lowercase letter (a-z)</span>
              </div>
              <div className={`flex items-center gap-2 ${checks.special ? 'text-emerald-400' : 'text-slate-400'}`}>
                {checks.special ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-slate-600" />}
                <span>At least one special character (!@#$%^&*)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !allCriteriaMet}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-600/30 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning Staff Account...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create Staff Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info & Recent Staff Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              RBAC Policy Rules
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Only <strong>Admin</strong> users can access this endpoint.</li>
              <li>Staff accounts are auto-assigned role <code className="text-purple-300">staff</code>.</li>
              <li>Public registration can never register staff accounts.</li>
              <li>Staff members cannot provision other staff.</li>
            </ul>
          </div>

          {createdStaffList.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Recently Provisioned Staff</h3>
              <div className="space-y-2">
                {createdStaffList.map((st) => (
                  <div key={st.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div className="font-semibold text-white">{st.name}</div>
                    <div className="text-slate-400">{st.email}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      ID: #{st.id} • Role: {st.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
