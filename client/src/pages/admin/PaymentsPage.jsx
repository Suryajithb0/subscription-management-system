import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Eye,
  RotateCw,
  Calendar,
  User,
  Package,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  ShieldCheck,
  Building,
  ArrowUpRight,
  Check,
  Receipt,
  XCircle,
  Banknote
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed', 'refunded'];
const METHOD_FILTERS = ['all', 'credit_card', 'bank_transfer', 'upi', 'cash', 'paypal'];

export const PaymentsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const [payments, setPayments] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
    totalCollected: 0,
    totalPending: 0
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Record Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [eligibleInvoices, setEligibleInvoices] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [formData, setFormData] = useState({
    invoice_id: '',
    customer_id: '',
    customer_name: '',
    amount: '',
    payment_method: 'credit_card',
    transaction_reference: '',
    payment_date: new Date().toISOString().substring(0, 10),
    status: 'completed',
    notes: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Payments
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedMethod !== 'all') params.append('payment_method', selectedMethod);
      params.append('page', page);
      params.append('limit', 10);

      const res = await api.get(`/payments?${params.toString()}`);
      if (res.data && res.data.success) {
        setPayments(res.data.data || []);
        if (res.data.metrics) setMetrics(res.data.metrics);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedMethod, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Open Record Payment Modal & Load Invoices with Outstanding Balances
  const handleOpenModal = async () => {
    setModalLoading(true);
    setFormErrors({});
    setSelectedInvoice(null);
    setFormData({
      invoice_id: '',
      customer_id: '',
      customer_name: '',
      amount: '',
      payment_method: 'credit_card',
      transaction_reference: '',
      payment_date: new Date().toISOString().substring(0, 10),
      status: 'completed',
      notes: ''
    });
    setShowModal(true);

    try {
      // Fetch open, pending, partially_paid, or overdue invoices
      const res = await api.get('/invoices?limit=100');
      if (res.data?.data) {
        // Filter invoices that have an outstanding balance > 0 and are not cancelled
        const unpaid = res.data.data.filter(
          (inv) => inv.balance_due > 0 && !['cancelled', 'void'].includes(inv.status)
        );
        setEligibleInvoices(unpaid);
      }
    } catch (err) {
      showNotification('error', 'Failed to load outstanding invoices.');
    } finally {
      setModalLoading(false);
    }
  };

  // Handle invoice selection in modal
  const handleSelectInvoice = (invoiceId) => {
    const inv = eligibleInvoices.find((i) => i.id === parseInt(invoiceId, 10));
    if (inv) {
      setSelectedInvoice(inv);
      setFormData((prev) => ({
        ...prev,
        invoice_id: inv.id,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        amount: inv.balance_due.toFixed(2)
      }));
    } else {
      setSelectedInvoice(null);
      setFormData((prev) => ({
        ...prev,
        invoice_id: '',
        customer_id: '',
        customer_name: '',
        amount: ''
      }));
    }
  };

  // Submit Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    if (!formData.invoice_id) errors.invoice_id = 'Please select an invoice';
    const amountVal = parseFloat(formData.amount);
    if (!amountVal || amountVal <= 0) {
      errors.amount = 'Amount must be greater than zero';
    } else if (selectedInvoice && amountVal > selectedInvoice.balance_due + 0.001) {
      errors.amount = `Amount cannot exceed outstanding balance of $${selectedInvoice.balance_due.toFixed(2)}`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        invoice_id: parseInt(formData.invoice_id, 10),
        customer_id: formData.customer_id ? parseInt(formData.customer_id, 10) : null,
        amount: amountVal,
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference.trim() || null,
        payment_date: formData.payment_date,
        status: formData.status,
        notes: formData.notes.trim() || null
      };

      const res = await api.post('/payments', payload);
      if (res.data?.success) {
        showNotification('success', `Payment #${res.data.data.payment.payment_number} recorded successfully!`);
        setShowModal(false);
        fetchPayments();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to record payment');
    } finally {
      setModalLoading(false);
    }
  };

  // Method Label & Badge Helper
  const renderMethodBadge = (method) => {
    const m = (method || 'other').toLowerCase();
    switch (m) {
      case 'credit_card':
      case 'card':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            <CreditCard className="h-3 w-3" />
            Credit Card
          </span>
        );
      case 'bank_transfer':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
            <Building className="h-3 w-3" />
            Bank Transfer
          </span>
        );
      case 'upi':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
            <ArrowUpRight className="h-3 w-3" />
            UPI
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <Banknote className="h-3 w-3" />
            Cash
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20 capitalize">
            {method?.replace('_', ' ') || 'Other'}
          </span>
        );
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const s = (status || 'completed').toLowerCase();
    switch (s) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 text-amber-400" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle className="h-3 w-3 text-rose-400" />
            Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <RotateCw className="h-3 w-3 text-slate-400" />
            Refunded
          </span>
        );
      default:
        return <span className="text-xs text-slate-400 capitalize">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md text-sm border transition-all animate-in fade-in slide-in-from-top-2 ${
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CreditCard className="h-7 w-7 text-emerald-400" />
            Payment Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track customer payments, reconcile invoice balances, and record multi-channel transactions.
          </p>
        </div>

        {isAdminOrStaff && (
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold transition shadow-lg shadow-emerald-600/30 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Payments"
          value={metrics.total.toString()}
          icon={Receipt}
          trend={{ value: `$${metrics.totalCollected.toLocaleString()}`, label: 'total collected', isPositive: true }}
          color="indigo"
        />
        <StatCard
          title="Completed Payments"
          value={metrics.completed.toString()}
          icon={CheckCircle2}
          trend={{ value: `${metrics.completed} successful`, label: 'reconciled', isPositive: true }}
          color="emerald"
        />
        <StatCard
          title="Pending Payments"
          value={metrics.pending.toString()}
          icon={Clock}
          trend={{ value: `$${metrics.totalPending.toLocaleString()}`, label: 'in clearance', isPositive: false }}
          color="amber"
        />
        <StatCard
          title="Failed / Refunded"
          value={(metrics.failed + metrics.refunded).toString()}
          icon={AlertCircle}
          trend={{ value: `${metrics.failed} failed, ${metrics.refunded} refunded`, label: 'exceptions', isPositive: false }}
          color="rose"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-4 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by payment #, txn ref, invoice #, customer..."
              className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-indigo-500/70 transition placeholder-slate-500"
            />
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline">Method:</span>
            <select
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/70 transition capitalize"
            >
              {METHOD_FILTERS.map((m) => (
                <option key={m} value={m}>
                  {m === 'all' ? 'All Methods' : m.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
          <span className="text-xs text-slate-400 font-medium mr-2 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-indigo-400" />
            Status:
          </span>
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition capitalize cursor-pointer ${
                selectedStatus === st
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" message="Loading payments from database..." />
          </div>
        ) : payments.length === 0 ? (
          <div className="py-16 px-4">
            <EmptyState
              icon={CreditCard}
              title="No Payment Records Found"
              description="No payments matched the search or filter criteria. Record your first payment against an eligible invoice."
              actionLabel={isAdminOrStaff ? 'Record Payment' : undefined}
              onAction={isAdminOrStaff ? handleOpenModal : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="py-3.5 pl-6 pr-4 font-semibold uppercase tracking-wider text-[11px]">Payment ID</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Invoice #</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Customer</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Amount</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Method</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Transaction Ref</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                  <th className="py-3.5 pl-4 pr-6 font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Payment ID */}
                    <td className="py-4 pl-6 pr-4 font-mono font-semibold text-white">
                      {p.payment_number}
                    </td>

                    {/* Invoice Number */}
                    <td className="py-4 px-4">
                      <button
                        onClick={() => navigate(`/invoices/${p.invoice_id}`)}
                        className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        {p.invoice_number}
                      </button>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{p.customer_name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[160px]">{p.customer_email}</div>
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ${p.amount.toFixed(2)}
                    </td>

                    {/* Method */}
                    <td className="py-4 px-4">
                      {renderMethodBadge(p.payment_method)}
                    </td>

                    {/* Transaction Reference */}
                    <td className="py-4 px-4 font-mono text-xs text-slate-400">
                      {p.transaction_reference || <span className="text-slate-600">—</span>}
                    </td>

                    {/* Date */}
                    <td className="py-4 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {p.payment_date}
                    </td>

                    {/* Status */}
                    <td className="py-4 pl-4 pr-6 text-center whitespace-nowrap">
                      {renderStatusBadge(p.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40">
            <div>
              Showing page <span className="font-semibold text-white">{pagination.page}</span> of{' '}
              <span className="font-semibold text-white">{pagination.totalPages}</span> ({pagination.total} payments)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Record Invoice Payment</h3>
                  <p className="text-xs text-slate-400">Reconcile transaction against outstanding balance.</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitPayment} className="p-6 space-y-4">
              {/* Invoice Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Target Invoice <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={formData.invoice_id}
                  onChange={(e) => handleSelectInvoice(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="">Select an outstanding invoice...</option>
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} (Balance: ${inv.balance_due.toFixed(2)})
                    </option>
                  ))}
                </select>
                {formErrors.invoice_id && (
                  <p className="text-xs text-rose-400 mt-1">{formErrors.invoice_id}</p>
                )}
              </div>

              {/* Customer Info (Auto-populated) */}
              {selectedInvoice && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Subscriber</span>
                    <span className="font-semibold text-white">{selectedInvoice.customer_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">Outstanding Balance</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      ${selectedInvoice.balance_due.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Payment Amount ($) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-950/80 border border-slate-800 text-white font-mono text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 transition"
                />
                {formErrors.amount && <p className="text-xs text-rose-400 mt-1">{formErrors.amount}</p>}
              </div>

              {/* Payment Method & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Payment Method <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="credit_card">Card (Credit/Debit)</option>
                    <option value="bank_transfer">Bank Wire / Transfer</option>
                    <option value="upi">UPI / Instant Pay</option>
                    <option value="cash">Cash</option>
                    <option value="paypal">PayPal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Payment Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Transaction / Reference ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.transaction_reference}
                  onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
                  placeholder="e.g. TXN-9482942-CH or UTR #129381"
                  className="w-full bg-slate-950/80 border border-slate-800 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Internal Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Received via wire transfer confirmation..."
                  className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-emerald-500 transition placeholder-slate-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Save Payment Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
