import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  CreditCard,
  User,
  Package,
  Calendar,
  Clock,
  RotateCw,
  PlayCircle,
  PauseCircle,
  XCircle,
  ArrowLeft,
  Building,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';

export const SubscriptionDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [subscriptionInvoices, setSubscriptionInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Cancel Confirmation Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const [res, invRes] = await Promise.all([
        api.get(`/subscriptions/${id}`),
        api.get(`/subscriptions/${id}/invoices`).catch(() => ({ data: { data: [] } }))
      ]);

      if (res.data && res.data.success) {
        setSubscription(res.data.data);
      }
      if (invRes.data?.data) {
        setSubscriptionInvoices(invRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Subscription not found');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/invoices/from-subscription/${id}`);
      if (res.data && res.data.success) {
        showNotification('success', `Invoice #${res.data.data.invoice_number} generated successfully!`);
        fetchSubscription();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [id]);

  const handleAction = async (action, payload = {}) => {
    setActionLoading(true);
    try {
      const res = await api.patch(`/subscriptions/${id}/status`, { action, ...payload });
      showNotification('success', res.data?.message || `Subscription ${action} successful.`);
      setShowCancelModal(false);
      fetchSubscription();
    } catch (err) {
      showNotification('error', err.response?.data?.message || `Failed to perform ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner message="Loading subscription details..." size="lg" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 max-w-md mx-auto text-xs">
          {error || 'Unable to load subscription record'}
        </div>
        <button
          onClick={() => navigate('/subscriptions')}
          className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Subscriptions
        </button>
      </div>
    );
  }

  const statusMap = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    expired: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium animate-in slide-in-from-top-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Back button and page title */}
      <div>
        <button
          onClick={() => navigate('/subscriptions')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Subscriptions
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              {subscription.subscription_number || `#SUB-${subscription.id}`}
              <span
                className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium border capitalize ${
                  statusMap[subscription.status] || statusMap.draft
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {subscription.status}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Customer: <strong className="text-slate-200 font-semibold">{subscription.customer_name}</strong> • Plan: <strong className="text-indigo-400 font-semibold">{subscription.plan_name}</strong>
            </p>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {subscription.status === 'draft' && (
              <button
                onClick={() => handleAction('activate')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
              >
                <PlayCircle className="h-4 w-4" /> Activate Subscription
              </button>
            )}

            {subscription.status === 'active' && (
              <>
                <button
                  onClick={() => handleAction('pause')}
                  disabled={actionLoading || !subscription.allow_pause}
                  title={!subscription.allow_pause ? 'Plan policy disallows pausing' : undefined}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold"
                >
                  <PauseCircle className="h-4 w-4" /> Pause
                </button>
                <button
                  onClick={() => handleAction('renew')}
                  disabled={actionLoading || !subscription.allow_renewal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  <RotateCw className="h-4 w-4" /> Renew Cycle
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              </>
            )}

            {subscription.status === 'paused' && (
              <>
                <button
                  onClick={() => handleAction('resume')}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
                >
                  <RotateCw className="h-4 w-4" /> Resume
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Left Subscription & Customer Details, Right Financials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Info Card */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white pb-3 border-b border-slate-800 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-400" /> Subscription Agreement Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Enrolled Product</span>
              <p className="text-slate-200 font-semibold mt-0.5">{subscription.product_name || 'Standard Cloud'}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Tier Plan</span>
              <p className="text-indigo-400 font-semibold mt-0.5">{subscription.plan_name}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Billing Cadence</span>
              <p className="text-slate-200 font-medium mt-0.5">{subscription.billing_cycle}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Next Scheduled Renewal</span>
              <p className="text-emerald-400 font-semibold font-mono mt-0.5">
                {subscription.next_billing_date || 'N/A'}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Start Date</span>
              <p className="text-slate-200 font-mono mt-0.5">{subscription.start_date}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Expiration / End Date</span>
              <p className="text-slate-200 font-mono mt-0.5">{subscription.end_date || 'Open-ended (No expiry)'}</p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Auto-Renewal Status</span>
              <p className="text-slate-200 font-medium mt-0.5">
                {subscription.auto_renew ? 'Enabled' : 'Disabled'}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Quantity Enrolled</span>
              <p className="text-slate-200 font-mono mt-0.5">{subscription.quantity} license(s)</p>
            </div>
          </div>

          {subscription.notes && (
            <div className="pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400 block text-[11px] mb-1">Administrative Notes:</span>
              <p className="text-slate-300 italic">{subscription.notes}</p>
            </div>
          )}

          {subscription.status === 'cancelled' && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <strong>Cancellation Recorded:</strong> {subscription.cancel_reason || 'No specific reason provided'}
            </div>
          )}
        </div>

        {/* Financial Summary Box */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-4 lg:col-span-1 h-fit">
          <h3 className="text-sm font-semibold text-white pb-3 border-b border-slate-800 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" /> Financial Summary
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Unit Price</span>
              <span className="font-mono text-slate-200">${Number(subscription.unit_price).toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Licensed Quantity</span>
              <span className="font-mono text-slate-200">{subscription.quantity}x</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="font-semibold text-white">Recurring Total</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                ${Number(subscription.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Customer Details Box */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
            <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">Subscriber</span>
            <p className="font-semibold text-white">{subscription.customer_name}</p>
            <p className="text-slate-400 flex items-center gap-1.5"><Mail className="h-3 w-3" /> {subscription.customer_email}</p>
            {subscription.customer_company && (
              <p className="text-slate-400 flex items-center gap-1.5"><Building className="h-3 w-3" /> {subscription.customer_company}</p>
            )}
          </div>
        </div>
      </div>

      {/* Related Invoices Section */}
      <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" /> Related Invoices & Statements
          </h3>

          {subscription.status === 'active' && (
            <button
              onClick={handleGenerateInvoice}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Generate Cycle Invoice</span>
            </button>
          )}
        </div>

        {subscriptionInvoices.length === 0 ? (
          <EmptyState
            title="No cycle invoices generated yet"
            description="Invoices for recurring renewals will automatically be recorded here upon billing execution."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Invoice #</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Issue Date</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Due Date</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] text-right">Total</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
                  <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {subscriptionInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-indigo-400">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {inv.issue_date}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {inv.due_date}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : inv.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/invoices/${inv.id}`)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline cursor-pointer"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Cancel Subscription</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to cancel subscription <strong className="text-white">{subscription.subscription_number}</strong>? This will discontinue recurring renewal billing.
            </p>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Cancellation Reason (Optional)</label>
              <textarea
                rows="2"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Client requested cancellation, service downgrade..."
                className="w-full bg-slate-900 text-white text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Keep Active
              </button>
              <button
                onClick={() => handleAction('cancel', { cancel_reason: cancelReason })}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
