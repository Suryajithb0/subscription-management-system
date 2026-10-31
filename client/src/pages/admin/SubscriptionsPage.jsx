import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  CreditCard,
  Layers,
  PlayCircle,
  PauseCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  Eye,
  RotateCw,
  Calendar,
  DollarSign,
  User,
  Package,
  Clock,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';

const STATUS_FILTERS = ['all', 'draft', 'active', 'paused', 'cancelled', 'expired'];

export const SubscriptionsPage = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, active: 0, paused: 0, cancelled: 0 });
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    plan_id: '',
    quantity: 1,
    start_date: new Date().toISOString().substring(0, 10),
    end_date: '',
    auto_renew: true,
    notes: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load dropdown resources (customers & plans)
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [custRes, planRes] = await Promise.all([
          api.get('/customers?status=active&limit=100').catch(() => ({ data: { data: [] } })),
          api.get('/plans?status=active&limit=100').catch(() => ({ data: { data: [] } })),
        ]);
        if (custRes.data?.data) setCustomers(custRes.data.data);
        if (planRes.data?.data) setPlans(planRes.data.data);
      } catch (err) {
        console.error('Failed to load dropdown records', err);
      }
    };
    loadDropdownData();
  }, []);

  // Fetch Subscriptions list
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/subscriptions', {
        params: {
          search: searchTerm,
          status: selectedStatus,
          customer_id: selectedCustomer,
          page,
          limit: 10,
        },
      });

      if (response.data && response.data.success) {
        setSubscriptions(response.data.data);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
        setPagination(response.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedCustomer, page]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Selected plan calculation preview
  const currentSelectedPlan = plans.find((p) => String(p.id) === String(formData.plan_id));
  const previewUnitPrice = currentSelectedPlan ? Number(currentSelectedPlan.price) : 0;
  const previewTotal = (previewUnitPrice * (Number(formData.quantity) || 1)).toFixed(2);

  const handleOpenCreateModal = () => {
    setFormData({
      customer_id: customers[0]?.id || '',
      plan_id: plans[0]?.id || '',
      quantity: 1,
      start_date: new Date().toISOString().substring(0, 10),
      end_date: '',
      auto_renew: true,
      notes: '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.customer_id) errors.customer_id = 'Please select a customer.';
    if (!formData.plan_id) errors.plan_id = 'Please select a plan.';
    if (Number(formData.quantity) < 1) errors.quantity = 'Quantity must be at least 1.';
    if (!formData.start_date) errors.start_date = 'Start date is required.';
    if (formData.end_date && new Date(formData.end_date) <= new Date(formData.start_date)) {
      errors.end_date = 'End date must be strictly after start date.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setActionLoading(true);
    try {
      await api.post('/subscriptions', formData);
      showNotification('success', 'Subscription created successfully.');
      setShowCreateModal(false);
      fetchSubscriptions();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to create subscription');
    } finally {
      setActionLoading(false);
    }
  };

  // Lifecycle Quick Action Handlers
  const handleLifecycleAction = async (id, action) => {
    try {
      await api.patch(`/subscriptions/${id}/status`, { action });
      showNotification('success', `Subscription status updated.`);
      fetchSubscriptions();
    } catch (err) {
      showNotification('error', err.response?.data?.message || `Failed to perform ${action}`);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Subscription ID',
      accessor: 'subscription_number',
      render: (row) => (
        <button
          onClick={() => navigate(`/subscriptions/${row.id}`)}
          className="font-mono text-xs font-semibold text-indigo-300 hover:text-indigo-200 text-left"
        >
          {row.subscription_number || `#SUB-${row.id}`}
        </button>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
            {(row.customer_name || 'C').charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-white text-xs">{row.customer_name}</p>
            <p className="text-[11px] text-slate-400">{row.customer_email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Plan & Product',
      accessor: 'plan_name',
      render: (row) => (
        <div>
          <span className="font-medium text-indigo-300 text-xs block">{row.plan_name}</span>
          <span className="text-[11px] text-slate-400">{row.product_name || 'Standard Service'}</span>
        </div>
      ),
    },
    {
      header: 'Start Date',
      accessor: 'start_date',
      render: (row) => (
        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
          <Calendar className="h-3 w-3 text-slate-500" />
          {row.start_date || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Next Billing',
      accessor: 'next_billing_date',
      render: (row) => (
        <span className="text-xs text-slate-300 flex items-center gap-1 font-mono font-medium">
          <Clock className="h-3 w-3 text-indigo-400" />
          {row.next_billing_date || 'Cycle End'}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'total_amount',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-white text-xs font-mono">
            ${Number(row.total_amount).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400">
            {row.quantity}x @ ${Number(row.unit_price).toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const statusMap = {
          draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
          active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          paused: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          expired: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
              statusMap[row.status] || statusMap.draft
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/subscriptions/${row.id}`)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {row.status === 'draft' && (
            <button
              onClick={() => handleLifecycleAction(row.id, 'activate')}
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Activate Subscription"
            >
              <PlayCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {row.status === 'active' && (
            <button
              onClick={() => handleLifecycleAction(row.id, 'pause')}
              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Pause Subscription"
            >
              <PauseCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {row.status === 'paused' && (
            <button
              onClick={() => handleLifecycleAction(row.id, 'resume')}
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Resume Subscription"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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

      {/* Page Header */}
      <PageHeader
        title="Subscription Directory"
        subtitle="Manage recurring customer subscriptions, activation states, pause schedules, and renewals"
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Create Subscription
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          icon={CreditCard}
          label="Total Subscriptions"
          value={metrics.total}
          trend={null}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          icon={PlayCircle}
          label="Active Subscriptions"
          value={metrics.active}
          trend={null}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={PauseCircle}
          label="Paused Subscriptions"
          value={metrics.paused}
          trend={null}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <StatCard
          icon={XCircle}
          label="Cancelled Subscriptions"
          value={metrics.cancelled}
          trend={null}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1129]/80 border border-slate-800/80">
        <div className="relative w-full lg:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by ID, customer name, email, plan..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900/80 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500 capitalize"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>

          {/* Customer Filter */}
          <select
            value={selectedCustomer}
            onChange={(e) => {
              setSelectedCustomer(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Subscriptions Table */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner message="Loading subscriptions..." />
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
          <DataTable
            columns={columns}
            data={subscriptions}
            emptyTitle="No subscriptions found"
            emptyDescription="Create a subscription to enroll customers in recurring plans."
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total subscriptions)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* CREATE SUBSCRIPTION MODAL */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                Create New Subscription
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="p-5 overflow-y-auto space-y-4">
              {/* Customer selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer *
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
                {formErrors.customer_id && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.customer_id}</p>
                )}
              </div>

              {/* Plan selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Subscription Plan *
                </label>
                <select
                  value={formData.plan_id}
                  onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${Number(p.price).toFixed(2)} / {p.billing_cycle}
                    </option>
                  ))}
                </select>
                {formErrors.plan_id && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.plan_id}</p>
                )}
              </div>

              {/* Quantity & Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {formErrors.quantity && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.quantity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.start_date && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.start_date}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
                {formErrors.end_date && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.end_date}</p>
                )}
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Estimated Initial Total (Preview)</span>
                  <span className="text-slate-300 font-medium">
                    {formData.quantity}x @ ${previewUnitPrice.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    ${previewTotal}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Verified on server</span>
                </div>
              </div>

              {/* Auto-renew & Notes */}
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.auto_renew}
                    onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Enable automatic recurring renewal</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Administrative Notes
                  </label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="PO number, client preferences, or billing instructions"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-md hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Create Draft Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
