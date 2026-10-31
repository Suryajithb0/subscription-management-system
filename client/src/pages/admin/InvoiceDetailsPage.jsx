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
  Plus,
  Receipt,
  Ticket,
  ExternalLink,
  ShieldCheck
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
  const [payments, setPayments] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Record Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [payFormData, setPayFormData] = useState({
    amount: '',
    payment_method: 'credit_card',
    transaction_reference: '',
    payment_date: new Date().toISOString().substring(0, 10),
    notes: ''
  });
  const [payErrors, setPayErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      const [res, printRes, payRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get(`/invoices/${id}/print`).catch(() => null),
        api.get(`/invoices/${id}/payments`).catch(() => null)
      ]);

      if (res.data && res.data.success) {
        setInvoice(res.data.data);
      }
      if (printRes?.data?.data?.company) {
        setCompanyInfo(printRes.data.data.company);
      }
      if (payRes?.data?.data) {
        setPayments(payRes.data.data);
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

  // Handle Cancel Invoice
  const handleCancelInvoice = async () => {
    if (!window.confirm('Are you sure you want to cancel this invoice? This will mark it as cancelled.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.patch(`/invoices/${id}/status`, { status: 'cancelled' });
      if (res.data?.success) {
        showNotification('success', 'Invoice cancelled.');
        fetchInvoiceData();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenPayModal = () => {
    setPayFormData({
      amount: invoice.balance_due ? Number(invoice.balance_due).toFixed(2) : '0.00',
      payment_method: 'credit_card',
      transaction_reference: `TXN-${invoice.invoice_number.replace('INV-', '')}-${Date.now().toString().slice(-4)}`,
      payment_date: new Date().toISOString().substring(0, 10),
      notes: `Settlement payment for invoice ${invoice.invoice_number}`
    });
    setPayErrors({});
    setShowPayModal(true);
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const errors = {};
    const amt = parseFloat(payFormData.amount);

    if (isNaN(amt) || amt <= 0) {
      errors.amount = 'Payment amount must be greater than $0.00';
    } else if (amt > invoice.balance_due + 0.001) {
      errors.amount = `Payment cannot exceed remaining balance of $${Number(invoice.balance_due).toFixed(2)}`;
    }

    if (Object.keys(errors).length > 0) {
      setPayErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        amount: amt,
        payment_method: payFormData.payment_method,
        transaction_reference: payFormData.transaction_reference.trim() || undefined,
        payment_date: payFormData.payment_date,
        status: 'completed',
        notes: payFormData.notes.trim() || undefined
      };

      const res = await api.post('/payments', payload);
      if (res.data?.success) {
        showNotification('success', `Payment of $${amt.toFixed(2)} recorded successfully!`);
        setShowPayModal(false);
        await fetchInvoiceData();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to record payment');
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
        <LoadingSpinner size="lg" message="Loading invoice and payment history..." />
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

          {/* Record Payment Action */}
          {isAdminOrStaff && ['pending', 'open', 'partially_paid', 'overdue'].includes(invoice.status) && (
            <button
              onClick={handleOpenPayModal}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>Record Payment</span>
            </button>
          )}

          {/* Cancel Invoice Action */}
          {isAdminOrStaff && !['cancelled', 'paid'].includes(invoice.status) && (
            <button
              onClick={handleCancelInvoice}
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
                  SubSphere Inc.
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
                    className="no-print text-xs text-indigo-400 hover:text-indigo-300 font-medium underline cursor-pointer"
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
                      ${Number(it.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                      {it.discount_amount > 0 ? `-$${Number(it.discount_amount).toFixed(2)}` : '$0.00'}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-400">
                      {(Number(it.tax_rate) * 100).toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-white font-mono">
                      ${Number(it.line_total).toFixed(2)}
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
              {invoice.notes || 'Payment is requested by due date. Thank you for your continued business with SubSphere!'}
            </p>
          </div>

          {/* Financial Breakdown Table */}
          <div className="w-full sm:w-80 space-y-2.5 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono text-slate-200">${Number(invoice.subtotal).toFixed(2)}</span>
            </div>

            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  Discount Total:
                </span>
                <span className="font-mono">-${Number(invoice.discount_amount).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-400">
              <span>Tax Amount:</span>
              <span className="font-mono text-slate-200">+${Number(invoice.tax_amount).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-base font-extrabold text-white border-t border-slate-800 pt-2">
              <span>Total Invoiced:</span>
              <span className="font-mono text-white">${Number(invoice.total).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs text-slate-400">
              <span>Amount Paid:</span>
              <span className="font-mono text-emerald-400">${Number(invoice.amount_paid).toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-sm font-bold text-amber-400 border-t border-slate-800/80 pt-2">
              <span>Balance Due:</span>
              <span className="font-mono">${Number(invoice.balance_due).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* PAYMENT HISTORY AUDIT TRAIL */}
        <div className="pt-6 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-400" />
              Recorded Payments History ({payments.length})
            </h4>
            {isAdminOrStaff && invoice.balance_due > 0 && (
              <button
                onClick={handleOpenPayModal}
                className="no-print text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
              >
                + Record Payment
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/50 text-center text-xs text-slate-500">
              No payments have been recorded for this invoice yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/80">
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Payment #</th>
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Amount</th>
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Method</th>
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Reference</th>
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Date</th>
                    <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                        {p.payment_number || `PAY-${p.id}`}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 capitalize">
                        {(p.payment_method || 'card').replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {p.transaction_reference || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {p.payment_date ? p.payment_date.substring(0, 10) : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          <span className="h-1 w-1 rounded-full bg-current" />
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invoice Footer / Signoff */}
        <div className="pt-6 border-t border-slate-800/60 text-center text-[11px] text-slate-500 space-y-1">
          <p>Questions? Contact SubSphere Billing Support at billing@subflow.io or call +1 (800) 555-0199.</p>
          <p>© 2026 SubSphere Subscription Management Inc. All rights reserved.</p>
        </div>
      </div>

      {/* RECORD INVOICE PAYMENT MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-400" />
                Record Payment for {invoice.invoice_number}
              </h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Balance Summary */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 block">Total Invoice:</span>
                <span className="font-mono font-bold text-white">${Number(invoice.total).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Paid to date:</span>
                <span className="font-mono font-bold text-emerald-400">${Number(invoice.amount_paid).toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Outstanding Balance:</span>
                <span className="font-mono font-bold text-amber-400">${Number(invoice.balance_due).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Payment Amount */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Payment Amount ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={invoice.balance_due}
                    value={payFormData.amount}
                    onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl pl-8 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none ${
                      payErrors.amount ? 'border-rose-500' : 'border-slate-800 focus:border-emerald-500'
                    }`}
                  />
                </div>
                {payErrors.amount && <p className="text-[11px] text-rose-400">{payErrors.amount}</p>}
              </div>

              {/* Payment Method & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Payment Method *
                  </label>
                  <select
                    value={payFormData.payment_method}
                    onChange={(e) => setPayFormData({ ...payFormData, payment_method: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="credit_card">Card (Credit/Debit)</option>
                    <option value="bank_transfer">Bank Transfer / Wire</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={payFormData.payment_date}
                    onChange={(e) => setPayFormData({ ...payFormData, payment_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Transaction Reference */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Transaction / Reference #
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-100234"
                  value={payFormData.transaction_reference}
                  onChange={(e) => setPayFormData({ ...payFormData, transaction_reference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional memo"
                  value={payFormData.notes}
                  onChange={(e) => setPayFormData({ ...payFormData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {actionLoading ? 'Recording Payment...' : 'Confirm & Apply Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
