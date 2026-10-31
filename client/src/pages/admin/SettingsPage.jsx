import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import {
  Settings,
  Shield,
  Database,
  Bell,
  Save,
  CheckCircle,
  Key,
  Globe,
  Cpu
} from 'lucide-react';

export const SettingsPage = () => {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    systemName: 'SubSphere Subscription Core',
    adminEmail: user?.email || 'admin@subflow.io',
    currency: 'USD ($)',
    reminderDays: '7',
    enableAuditLogs: true,
    enableAutoInvoicing: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300">
      <PageHeader
        title="System Settings"
        subtitle="Configure platform billing policies, notification defaults, and security configurations"
      />

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Settings successfully updated.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Platform Identity */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-white font-semibold text-sm">
            <Globe className="h-4 w-4 text-indigo-400" />
            General Platform Settings
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Platform Name
              </label>
              <input
                type="text"
                name="systemName"
                value={formData.systemName}
                onChange={handleChange}
                className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Default Currency
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="USD ($)">USD ($) - US Dollar</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
              </select>
            </div>
          </div>
        </div>

        {/* Subscription & Billing Rules */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-white font-semibold text-sm">
            <Bell className="h-4 w-4 text-violet-400" />
            Renewal Notifications & Automation
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Renewal Reminder Notice (Days prior to expiration)
            </label>
            <input
              type="number"
              name="reminderDays"
              value={formData.reminderDays}
              onChange={handleChange}
              className="w-32 bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="enableAutoInvoicing"
                checked={formData.enableAutoInvoicing}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300">
                Automatically generate and deliver invoices on billing renewal
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="enableAuditLogs"
                checked={formData.enableAuditLogs}
                onChange={handleChange}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-300">
                Enable detailed audit logging for administrative mutations
              </span>
            </label>
          </div>
        </div>

        {/* Database & Environment Info */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-white font-semibold text-sm">
            <Database className="h-4 w-4 text-cyan-400" />
            Connected Environment Info
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400 block text-[11px]">Database Engine</span>
              <span className="text-slate-200 font-mono font-medium">MySQL (WAMP)</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400 block text-[11px]">Database Name</span>
              <span className="text-slate-200 font-mono font-medium">subflow_db</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60">
              <span className="text-slate-400 block text-[11px]">Security Protocol</span>
              <span className="text-slate-200 font-mono font-medium">JWT + Argon/Bcrypt</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Save className="h-4 w-4" />
            Save Configurations
          </button>
        </div>
      </form>
    </div>
  );
};
