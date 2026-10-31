import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  FileText,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Printer,
  XCircle,
  RotateCw,
  Calendar,
  User,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Sparkles,
  Receipt,
  ShieldCheck,
  Send
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const STATUS_FILTERS = ['all', 'draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'];

export const InvoicesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const [invoices, setInvoices] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    draft: 0,
    totalVolume: 0,
    totalCollected: 0,
    totalOutstanding: 0
  });

  const [customers, setCustomers] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [availableSubscriptions, setAvailableSubscriptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [billingRunning, setBillingRunning] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const initialFormState = {
    customer_id: '',
    subscription_id: '',
    issue_date: new Date().toISOString().substring(0, 10),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
    billing_period: '',
    notes: '',
    status: 'draft',
    amount_paid: 0,
    items: [
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_amount: 0,
        tax_id: ''
      }
    ]
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  // Load dropdown resources (Customers & Taxes)
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const [custRes, taxRes] = await Promise.all([
          api.get('/customers?limit=100').catch(() => ({ data: { data: [] } })),
          api.get('/invoices/taxes').catch(() => ({ data: { data: [] } }))
        ]);

        if (custRes.data?.data) setCustomers(custRes.data.data);
        if (taxRes.data?.data) setTaxes(taxRes.data.data);
      } catch (err) {
        console.error('Failed to load resources:', err);
      }
    };

    fetchResources();
  }, []);

  // Fetch customer subscriptions when customer selected in modal
  const handleCustomerChange = async (customerId) => {
    setFormData((prev) => ({ ...prev, customer_id: customerId, subscription_id: '' }));
    if (!customerId) {
      setAvailableSubscriptions([]);
      return;
    }

    try {
      const res = await api.get(`/subscriptions?customer_id=${customerId}&limit=50`);
      if (res.data?.data) {
        setAvailableSubscriptions(res.data.data);
      }
    } catch {
      setAvailableSubscriptions([]);
    }
  };

  // Load Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedCustomer !== 'all') params.append('customer_id', selectedCustomer);
      params.append('page', page);
      params.append('limit', 10);

      const res = await api.get(`/invoices?${params.toString()}`);
      if (res.data && res.data.success) {
        setInvoices(res.data.data || []);
        if (res.data.metrics) setMetrics(res.data.metrics);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedCustomer, page]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Search Input with debounce
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  // Automated recurring billing trigger
  const handleTriggerRecurringBilling = async () => {
    setBillingRunning(true);
    try {
      const res = await api.post('/invoices/trigger-billing');
      if (res.data && res.data.success) {
        const genCount = res.data.data?.invoicesGenerated?.length || 0;
        showNotification(
          'success',
          `Automated billing executed: ${genCount} invoice(s) generated successfully!`
        );
        fetchInvoices();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to run automated recurring billing');
    } finally {
      setBillingRunning(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingInvoiceId(null);
    setFormData(initialFormState);
    setFormErrors({});
    setShowModal(true);
  };

  // Open Edit Modal for Draft/Pending Invoice
  const handleOpenEditModal = (inv) => {
    if (['paid', 'cancelled'].includes(inv.status)) {
      showNotification('error', `Cannot edit invoice with status '${inv.status}'.`);
      return;
    }

    setModalMode('edit');
    setEditingInvoiceId(inv.id);
    setFormData({
      customer_id: inv.customer_id,
      subscription_id: inv.subscription_id || '',
      issue_date: inv.issue_date || new Date().toISOString().substring(0, 10),
      due_date: inv.due_date || new Date().toISOString().substring(0, 10),
      billing_period: inv.billing_period || '',
      notes: inv.notes || '',
      status: inv.status,
      amount_paid: inv.amount_paid || 0,
      items: inv.items && inv.items.length > 0 ? inv.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        tax_id: item.tax_id || ''
      })) : [
        {
          description: '',
          quantity: 1,
          unit_price: 0,
          discount_amount: 0,
          tax_id: ''
        }
      ]
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Status quick patch (Mark Paid or Cancel)
  const handleStatusChange = async (invoiceId, targetStatus) => {
    if (!window.confirm(`Are you sure you want to mark this invoice as ${targetStatus.toUpperCase()}?`)) {
      return;
    }

    try {
      const res = await api.patch(`/invoices/${invoiceId}/status`, { status: targetStatus });
      if (res.data?.success) {
        showNotification('success', `Invoice marked as ${targetStatus}.`);
        fetchInvoices();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || `Failed to update status to ${targetStatus}`);
    }
  };

  // Line item manipulation
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { description: '', quantity: 1, unit_price: 0, discount_amount: 0, tax_id: '' }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length === 1) {
      showNotification('error', 'Invoice must have at least one line item.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // Live Calculations Preview
  const calculateLiveTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    formData.items.forEach((item) => {
      const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
      const price = Math.max(0, parseFloat(item.unit_price) || 0);
      const discount = Math.max(0, parseFloat(item.discount_amount) || 0);

      const raw = qty * price;
      const net = Math.max(0, raw - discount);

      let rate = 0;
      if (item.tax_id) {
        const found = taxes.find((t) => t.id === parseInt(item.tax_id, 10));
        if (found) rate = parseFloat(found.rate) || 0;
      }

      const itemTax = Math.round(net * rate * 100) / 100;

      subtotal += raw;
      discountTotal += discount;
      taxTotal += itemTax;
    });

    const total = Math.max(0, subtotal - discountTotal + taxTotal);
    const amountPaid = Math.max(0, parseFloat(formData.amount_paid) || 0);
    const balanceDue = Math.max(0, total - amountPaid);

    return {
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balanceDue: balanceDue.toFixed(2)
    };
  };

  const liveTotals = calculateLiveTotals();

  // Submit Modal (Create or Edit)
  const handleSubmitModal = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    if (!formData.customer_id) errors.customer_id = 'Please select a customer';
    if (!formData.issue_date) errors.issue_date = 'Issue date is required';
    if (!formData.due_date) errors.due_date = 'Due date is required';

    formData.items.forEach((item, idx) => {
      if (!item.description.trim()) {
        errors[`item_${idx}_desc`] = 'Description required';
      }
      if (item.quantity <= 0) {
        errors[`item_${idx}_qty`] = 'Qty > 0';
      }
      if (item.unit_price < 0) {
        errors[`item_${idx}_price`] = 'Price >= 0';
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setModalSubmitting(true);
    try {
      if (modalMode === 'create') {
        const payload = {
          customer_id: formData.customer_id,
          subscription_id: formData.subscription_id || null,
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          billing_period: formData.billing_period,
          notes: formData.notes,
          status: formData.status,
          amount_paid: formData.amount_paid,
          items: formData.items.map((i) => ({
            description: i.description.trim(),
            quantity: parseInt(i.quantity, 10),
            unit_price: parseFloat(i.unit_price),
            discount_amount: parseFloat(i.discount_amount || 0),
            tax_id: i.tax_id ? parseInt(i.tax_id, 10) : null
          }))
        };

        const res = await api.post('/invoices', payload);
        if (res.data?.success) {
          showNotification('success', `Invoice #${res.data.data.invoice_number} created successfully!`);
          setShowModal(false);
          fetchInvoices();
        }
      } else {
        const payload = {
          issue_date: formData.issue_date,
          due_date: formData.due_date,
          billing_period: formData.billing_period,
          notes: formData.notes,
          items: formData.items.map((i) => ({
            description: i.description.trim(),
            quantity: parseInt(i.quantity, 10),
            unit_price: parseFloat(i.unit_price),
            discount_amount: parseFloat(i.discount_amount || 0),
            tax_id: i.tax_id ? parseInt(i.tax_id, 10) : null
          }))
        };

        const res = await api.put(`/invoices/${editingInvoiceId}`, payload);
        if (res.data?.success) {
          showNotification('success', 'Invoice updated successfully!');
          setShowModal(false);
          fetchInvoices();
        }
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save invoice');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    const s = (status || 'draft').toLowerCase();
    switch (s) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Paid
          </span>
        );
      case 'pending':
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Pending
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Partial
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
            Overdue
          </span>
        );
      case 'cancelled':
      case 'void':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-indigo-400" />
            Invoices & Billing Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Automated recurring subscription billing, tax accounting, and invoice lifecycle management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdminOrStaff && (
            <button
              onClick={handleTriggerRecurringBilling}
              disabled={billingRunning}
              title="Runs automated recurring billing engine to process all subscriptions with due billing dates"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-medium transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`h-4 w-4 text-cyan-400 ${billingRunning ? 'animate-spin' : ''}`} />
              <span>{billingRunning ? 'Processing Billing...' : 'Trigger Due Billing'}</span>
            </button>
          )}

          {isAdminOrStaff && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoices"
          value={metrics.total.toString()}
          icon={FileText}
          trend={{ value: `$${metrics.totalVolume.toLocaleString()}`, label: 'total billed', isPositive: true }}
          color="indigo"
        />
        <StatCard
          title="Paid Invoices"
          value={metrics.paid.toString()}
          icon={CheckCircle2}
          trend={{ value: `$${metrics.totalCollected.toLocaleString()}`, label: 'collected', isPositive: true }}
          color="emerald"
        />
        <StatCard
          title="Pending Invoices"
          value={metrics.pending.toString()}
          icon={Clock}
          trend={{ value: `$${metrics.totalOutstanding.toLocaleString()}`, label: 'outstanding', isPositive: false }}
          color="amber"
        />
        <StatCard
          title="Overdue Invoices"
          value={metrics.overdue.toString()}
          icon={AlertCircle}
          trend={{ value: `${metrics.draft} Drafts`, label: 'in preparation', isPositive: false }}
          color="rose"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-4 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by invoice #, customer name, email..."
              className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/40 transition placeholder-slate-500"
            />
          </div>

          {/* Customer Dropdown Filter */}
          {isAdminOrStaff && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline">Customer:</span>
              <select
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950/80 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/70 transition"
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `${c.first_name || ''} ${c.last_name || ''}`}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" message="Loading invoices from database..." />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 px-4">
            <EmptyState
              icon={Receipt}
              title="No Invoices Found"
              description="No invoice records matched your active filters. Try resetting filters or create a new invoice."
              actionLabel={isAdminOrStaff ? 'Create First Invoice' : undefined}
              onAction={isAdminOrStaff ? handleOpenCreateModal : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="py-3.5 pl-6 pr-4 font-semibold uppercase tracking-wider text-[11px]">Invoice #</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Customer</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Issue Date</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Due Date</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Total</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Balance</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
                  <th className="py-3.5 pl-4 pr-6 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors group">
                    {/* Invoice Number */}
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition text-left cursor-pointer"
                        >
                          {inv.invoice_number}
                        </button>
                      </div>
                      {inv.subscription_number && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Linked: {inv.subscription_number}
                        </div>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-white">{inv.customer_name}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[180px]">{inv.customer_email}</div>
                    </td>

                    {/* Issue Date */}
                    <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                      {inv.issue_date}
                    </td>

                    {/* Due Date */}
                    <td className="py-4 px-4 text-xs whitespace-nowrap">
                      <span className={inv.status === 'overdue' ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                        {inv.due_date}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="py-4 px-4 text-right font-bold text-white whitespace-nowrap">
                      ${inv.total.toFixed(2)}
                    </td>

                    {/* Balance Due */}
                    <td className="py-4 px-4 text-right font-medium whitespace-nowrap">
                      {inv.balance_due <= 0 ? (
                        <span className="text-emerald-400 text-xs">$0.00</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-semibold">${inv.balance_due.toFixed(2)}</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(inv.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View */}
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View Invoice Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Print */}
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}?print=true`)}
                          title="Print Invoice"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* Edit Draft */}
                        {isAdminOrStaff && ['draft', 'pending'].includes(inv.status) && (
                          <button
                            onClick={() => handleOpenEditModal(inv)}
                            title="Edit Draft Invoice"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* Quick Mark Paid */}
                        {isAdminOrStaff && ['pending', 'open', 'partially_paid', 'overdue'].includes(inv.status) && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'paid')}
                            title="Mark as Paid"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* Cancel */}
                        {isAdminOrStaff && !['cancelled', 'paid'].includes(inv.status) && (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'cancelled')}
                            title="Cancel Invoice"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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
              <span className="font-semibold text-white">{pagination.totalPages}</span> ({pagination.total} invoices)
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

      {/* CREATE / EDIT INVOICE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {modalMode === 'create' ? 'Create New Invoice' : 'Edit Draft Invoice'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {modalMode === 'create'
                      ? 'Manually provision an invoice with live calculation breakdown.'
                      : 'Update item descriptions, rates, discounts, and terms.'}
                  </p>
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
            <form onSubmit={handleSubmitModal} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Row 1: Customer & Optional Subscription */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Customer <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.customer_id}
                    disabled={modalMode === 'edit'}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="">Select a Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `${c.first_name || ''} ${c.last_name || ''}`} ({c.email})
                      </option>
                    ))}
                  </select>
                  {formErrors.customer_id && (
                    <p className="text-xs text-rose-400 mt-1">{formErrors.customer_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Linked Subscription (Optional)
                  </label>
                  <select
                    value={formData.subscription_id}
                    disabled={modalMode === 'edit'}
                    onChange={(e) => setFormData({ ...formData, subscription_id: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="">Standalone Invoice (No Subscription)</option>
                    {availableSubscriptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subscription_number} — {s.plan_name} (${parseFloat(s.total_amount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Dates & Billing Period */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Issue Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {formErrors.issue_date && (
                    <p className="text-xs text-rose-400 mt-1">{formErrors.issue_date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Due Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition"
                  />
                  {formErrors.due_date && (
                    <p className="text-xs text-rose-400 mt-1">{formErrors.due_date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Billing Period Description
                  </label>
                  <input
                    type="text"
                    value={formData.billing_period}
                    onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                    placeholder="e.g. Oct 2026 Monthly Retainer"
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 transition placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    Invoice Line Items
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, idx) => {
                    const lineQty = Math.max(0, parseInt(item.quantity, 10) || 0);
                    const linePrice = Math.max(0, parseFloat(item.unit_price) || 0);
                    const lineDiscount = Math.max(0, parseFloat(item.discount_amount) || 0);
                    const net = Math.max(0, lineQty * linePrice - lineDiscount);
                    let lineTaxRate = 0;
                    if (item.tax_id) {
                      const t = taxes.find((tx) => tx.id === parseInt(item.tax_id, 10));
                      if (t) lineTaxRate = parseFloat(t.rate) || 0;
                    }
                    const lineTax = Math.round(net * lineTaxRate * 100) / 100;
                    const computedLineTotal = (net + lineTax).toFixed(2);

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                      >
                        {/* Description */}
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Description <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Service or product description"
                            className="w-full bg-slate-900 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Qty */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Qty <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Unit Price ($) <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        {/* Tax */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Applicable Tax
                          </label>
                          <select
                            value={item.tax_id}
                            onChange={(e) => handleItemChange(idx, 'tax_id', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700/80 text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">No Tax (0%)</option>
                            {taxes.map((tx) => (
                              <option key={tx.id} value={tx.id}>
                                {tx.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Line Total & Remove */}
                        <div className="sm:col-span-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-medium">Line Total</span>
                            <span className="font-mono text-xs font-bold text-emerald-400">${computedLineTotal}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Notes & Live Calculation Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                <div className="lg:col-span-7">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Invoice Notes / Payment Instructions
                  </label>
                  <textarea
                    rows="4"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter payment wire details, check instructions, or terms..."
                    className="w-full bg-slate-950/80 border border-slate-800 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition placeholder-slate-500"
                  />
                </div>

                {/* Live Calculation Preview Card */}
                <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    Live Calculation Preview
                  </h5>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-200">${liveTotals.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Discount Total:</span>
                    <span className="font-mono text-slate-200">-${liveTotals.discountTotal}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Tax Amount:</span>
                    <span className="font-mono text-slate-200">+${liveTotals.taxTotal}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-2">
                    <span>Invoice Total:</span>
                    <span className="font-mono text-emerald-400">${liveTotals.total}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-400 font-medium">
                    <span>Balance Due:</span>
                    <span className="font-mono">${liveTotals.balanceDue}</span>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {modalSubmitting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Saving Invoice...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>{modalMode === 'create' ? 'Create & Save Invoice' : 'Update Invoice'}</span>
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
