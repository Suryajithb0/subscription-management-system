import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  FileText,
  Printer,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  DollarSign,
  XCircle,
  CreditCard,
  Edit2,
  X,
  Trash2,
  Plus
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export const InvoiceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const [invoice, setInvoice] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Quick Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/invoices/${id}`);
      if (res.data && res.data.success) {
        setInvoice(res.data.data);
      }

      // Also get corporate print metadata
      const printRes = await api.get(`/invoices/${id}/print`).catch(() => null);
      if (printRes?.data?.data?.company) {
        setCompanyInfo(printRes.data.data.company);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  // Auto trigger print if ?print=true is present
  useEffect(() => {
    if (!loading && invoice && searchParams.get('print') === 'true') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, invoice, searchParams]);

  // Handle Status Update (Mark Paid / Cancel)
  const handleUpdateStatus = async (newStatus, amountPaid = null) => {
    setActionLoading(true);
    try {
      const payload = { status: newStatus };
      if (amountPaid !== null) payload.amount_paid = amountPaid;

      const res = await api.patch(`/invoices/${id}/status`, payload);
      if (res.data?.success) {
        showNotification('success', `Invoice marked as ${newStatus}.`);
        fetchInvoiceData();
        setShowPayModal(false);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || `Failed to update status to ${newStatus}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const s = (status || 'draft').toLowerCase();
    switch (s) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Paid
          </span>
        );
      case 'pending':
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            Pending Payment
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Partially Paid
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            Overdue
          </span>
        );
      case 'cancelled':
      case 'void':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <XCircle className="h-3.5 w-3.5 text-slate-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FileText className="h-3.5 w-3.5 text-purple-400" />
            Draft
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingSpinner size="lg" message="Loading invoice details..." />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="py-16">
        <EmptyState
          icon={AlertCircle}
          title="Invoice Not Found"
          description={error || "The requested invoice could not be located in the database."}
          actionLabel="Back to Invoices"
          onAction={() => navigate('/invoices')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`no-print fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-sm border transition-all animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header / Action Toolbar (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <button
          onClick={() => navigate('/invoices')}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Invoices Directory</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <Printer className="h-4 w-4 text-cyan-400" />
            <span>Print / Save PDF</span>
          </button>

          {/* Mark as Paid Action */}
          {isAdminOrStaff && ['pending', 'open', 'partially_paid', 'overdue'].includes(invoice.status) && (
            <button
              onClick={() => {
                setPayAmount(invoice.balance_due.toString());
                setShowPayModal(true);
              }}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          )}

          {/* Cancel Invoice Action */}
          {isAdminOrStaff && !['cancelled', 'paid'].includes(invoice.status) && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this invoice? This action will mark it cancelled.')) {
                  handleUpdateStatus('cancelled');
                }
              }}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-800/80 hover:bg-rose-900/60 text-rose-300 text-xs font-medium transition cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* PRINTABLE INVOICE CARD */}
      <div className="printable-invoice-card bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md space-y-8">
        {/* Header Block: Branding + Invoice Number & Status */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <div className="h-full w-full bg-[#0d0f24] rounded-[10px] flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                </div>
              </div>
              <div>
                <span className="font-extrabold text-xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                  SubFlow Inc.
                </span>
                <p className="text-[11px] text-slate-400">Subscription & Billing Platform</p>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-400 space-y-0.5">
              <p>{companyInfo?.address || '100 Innovation Way, Suite 400'}</p>
              <p>{companyInfo?.city || 'San Francisco, CA 94105, United States'}</p>
              <p>Email: {companyInfo?.email || 'billing@subflow.io'}</p>
            </div>
          </div>

          <div className="text-left sm:text-right space-y-2">
            <div className="inline-block">{renderStatusBadge(invoice.status)}</div>
            <h2 className="text-2xl font-black font-mono text-white tracking-tight">
              {invoice.invoice_number}
            </h2>
            <div className="text-xs text-slate-400 space-y-1">
              <div>
                <span className="text-slate-500 font-medium">Issue Date:</span>{' '}
                <span className="text-white font-medium">{invoice.issue_date}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Payment Due:</span>{' '}
                <span className={invoice.status === 'overdue' ? 'text-rose-400 font-bold' : 'text-white font-medium'}>
                  {invoice.due_date}
                </span>
              </div>
              {invoice.billing_period && (
                <div>
                  <span className="text-slate-500 font-medium">Period:</span>{' '}
                  <span className="text-indigo-300 font-medium">{invoice.billing_period}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer & Linked Subscription Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          {/* Bill To */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block mb-2">
              Billed To:
            </span>
            <h4 className="text-sm font-bold text-white">{invoice.customer_name}</h4>
            {invoice.customer_company && (
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-slate-500" />
                {invoice.customer_company}
              </p>
            )}
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-500" />
              {invoice.customer_email}
            </p>
            {invoice.customer_phone && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {invoice.customer_phone}
              </p>
            )}
            {(invoice.billing_address || invoice.customer_address) && (
              <p className="text-xs text-slate-400 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  {invoice.billing_address || invoice.customer_address}
                  {invoice.customer_city ? `, ${invoice.customer_city}` : ''}
                  {invoice.customer_state ? `, ${invoice.customer_state}` : ''}
                  {invoice.customer_country ? `, ${invoice.customer_country}` : ''}
                </span>
              </p>
            )}
          </div>

          {/* Subscription / Plan Reference */}
          <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-6 pt-4 md:pt-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block mb-2">
              Billing & Subscription Reference:
            </span>
            {invoice.subscription_number ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500">Subscription Number:</span>{' '}
                  <span className="font-mono font-semibold text-white">{invoice.subscription_number}</span>
                </div>
                <div>
                  <span className="text-slate-500">Billing Cycle:</span>{' '}
                  <span className="font-medium text-slate-200 capitalize">{invoice.subscription_billing_cycle || 'Monthly'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Subscription Status:</span>{' '}
                  <span className="capitalize text-emerald-400 font-semibold">{invoice.subscription_status || 'Active'}</span>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => navigate(`/subscriptions/${invoice.subscription_id}`)}
                    className="no-print text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
                  >
                    View Subscription Lifecycle Details →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Standalone manual invoice. Not tied to a recurring subscription cycle.
              </div>
            )}
          </div>
        </div>

        {/* Itemized Invoice Charges Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Description</th>
                <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px] text-center">Qty</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Unit Price</th>
                <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px] text-right">Discount</th>
                <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px] text-right">Tax Rate</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">
                      {it.description}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono">
                      {it.quantity}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      ${it.unit_price.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                      {it.discount_amount > 0 ? `-$${it.discount_amount.toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-400">
                      {(it.tax_rate * 100).toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                      ${it.line_total.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500 italic">
                    No individual line items listed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-800/80">
          {/* Notes & Terms */}
          <div className="flex-1 space-y-2">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Notes & Payment Terms
            </h5>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
              {invoice.notes || 'Payment is requested by due date. Thank you for your continued business with SubFlow!'}
            </p>
          </div>

          {/* Financial Breakdown Table */}
          <div className="w-full sm:w-80 space-y-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200">${invoice.subtotal.toFixed(2)}</span>
            </div>

            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Discount Total:</span>
                <span className="font-mono text-slate-200">-${invoice.discount_amount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-400">
              <span>Tax Amount:</span>
              <span className="font-mono text-slate-200">+${invoice.tax_amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-extrabold text-white border-t border-slate-800 pt-2">
              <span>Total Amount:</span>
              <span className="font-mono text-emerald-400">${invoice.total.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Amount Paid:</span>
              <span className="font-mono text-slate-300">${invoice.amount_paid.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-amber-400 border-t border-slate-800/80 pt-2">
              <span>Balance Due:</span>
              <span className="font-mono">${invoice.balance_due.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Invoice Footer / Signoff */}
        <div className="pt-6 border-t border-slate-800/60 text-center text-[11px] text-slate-500 space-y-1">
          <p>Questions? Contact SubFlow Billing Support at billing@subflow.io or call +1 (800) 555-0199.</p>
          <p>© 2026 SubFlow Subscription Management Inc. All rights reserved.</p>
        </div>
      </div>

      {/* QUICK PAYMENT RECORD MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Record Invoice Payment
              </h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Recording payment for invoice <strong className="text-white">{invoice.invoice_number}</strong>. Total is{' '}
              <strong className="text-emerald-400">${invoice.total.toFixed(2)}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Payment Amount Received ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.total}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-sm rounded-xl p-3 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !payAmount}
                onClick={() => {
                  const amt = parseFloat(payAmount);
                  if (amt >= invoice.total) {
                    handleUpdateStatus('paid');
                  } else {
                    handleUpdateStatus('partially_paid', amt);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30"
              >
                {actionLoading ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
