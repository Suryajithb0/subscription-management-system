import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  Layers,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Power,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign,
  Package,
  Clock,
  ShieldAlert,
  Check,
  PauseCircle,
  Repeat
} from 'lucide-react';
import api from '../../services/api';

const BILLING_CYCLES = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

export const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedCycle, setSelectedCycle] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Plan Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingPlan, setEditingPlan] = useState(null);

  // Deactivate / Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    description: '',
    price: '',
    billing_cycle: 'Monthly',
    minimum_quantity: 1,
    available_from: '',
    available_until: '',
    auto_close: false,
    allow_pause: true,
    allow_early_close: true,
    allow_renewal: true,
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Active Products for dropdown
  useEffect(() => {
    const fetchActiveProducts = async () => {
      try {
        const res = await api.get('/products?status=active&limit=100');
        if (res.data && res.data.success) {
          setProducts(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load active products', err);
      }
    };
    fetchActiveProducts();
  }, []);

  // Fetch Plans list
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/plans', {
        params: {
          search: searchTerm,
          product_id: selectedProduct,
          billing_cycle: selectedCycle,
          status: selectedStatus,
          page,
          limit: 10,
        },
      });
      if (response.data && response.data.success) {
        setPlans(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to fetch plans');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedProduct, selectedCycle, selectedStatus, page]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Form Open Handlers
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingPlan(null);
    setFormData({
      product_id: products[0]?.id || '',
      name: '',
      description: '',
      price: '',
      billing_cycle: 'Monthly',
      minimum_quantity: 1,
      available_from: '',
      available_until: '',
      auto_close: false,
      allow_pause: true,
      allow_early_close: true,
      allow_renewal: true,
      is_active: true,
    });
    setFormErrors({});
    setShowPlanModal(true);
  };

  const handleOpenEditModal = (plan) => {
    setModalMode('edit');
    setEditingPlan(plan);
    setFormData({
      product_id: plan.product_id,
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      billing_cycle: plan.billing_cycle || 'Monthly',
      minimum_quantity: plan.minimum_quantity || 1,
      available_from: plan.available_from ? plan.available_from.substring(0, 10) : '',
      available_until: plan.available_until ? plan.available_until.substring(0, 10) : '',
      auto_close: Boolean(plan.auto_close),
      allow_pause: Boolean(plan.allow_pause),
      allow_early_close: Boolean(plan.allow_early_close),
      allow_renewal: Boolean(plan.allow_renewal),
      is_active: Boolean(plan.is_active),
    });
    setFormErrors({});
    setShowPlanModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.product_id) errors.product_id = 'Please select a product.';
    if (!formData.name.trim()) errors.name = 'Plan name is required.';
    if (formData.price === '' || isNaN(formData.price) || Number(formData.price) < 0) {
      errors.price = 'Price must be 0 or higher.';
    }
    if (Number(formData.minimum_quantity) < 1) {
      errors.minimum_quantity = 'Minimum quantity must be at least 1.';
    }
    if (formData.available_from && formData.available_until) {
      if (new Date(formData.available_from) > new Date(formData.available_until)) {
        errors.available_until = 'Until date cannot be earlier than from date.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setActionLoading(true);
    try {
      if (modalMode === 'create') {
        await api.post('/plans', formData);
        showNotification('success', 'Subscription plan created successfully.');
      } else {
        await api.put(`/plans/${editingPlan.id}`, formData);
        showNotification('success', 'Subscription plan updated successfully.');
      }
      setShowPlanModal(false);
      fetchPlans();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (plan) => {
    try {
      const nextStatus = !plan.is_active;
      await api.patch(`/plans/${plan.id}/status`, { is_active: nextStatus });
      showNotification('success', `Plan ${nextStatus ? 'activated' : 'deactivated'}.`);
      fetchPlans();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to update plan status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/plans/${planToDelete.id}`);
      showNotification('success', res.data?.message || 'Plan removed.');
      setShowDeleteModal(false);
      setPlanToDelete(null);
      fetchPlans();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to remove plan');
    } finally {
      setActionLoading(false);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Plan Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{row.name}</p>
            <p className="text-xs text-slate-400 truncate max-w-xs">{row.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Product Offering',
      accessor: 'product_name',
      render: (row) => (
        <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-indigo-400" />
          {row.product_name}
        </span>
      ),
    },
    {
      header: 'Price',
      accessor: 'price',
      render: (row) => (
        <span className="font-bold text-white text-sm font-mono">
          ${Number(row.price).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Billing Cycle',
      accessor: 'billing_cycle',
      render: (row) => {
        const cycleColors = {
          Daily: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          Weekly: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          Monthly: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
          Yearly: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
        };
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
              cycleColors[row.billing_cycle] || cycleColors.Monthly
            }`}
          >
            <Clock className="h-3 w-3" />
            {row.billing_cycle}
          </span>
        );
      },
    },
    {
      header: 'Min Qty',
      accessor: 'minimum_quantity',
      render: (row) => (
        <span className="text-xs text-slate-300 font-mono">
          {row.minimum_quantity} unit(s)
        </span>
      ),
    },
    {
      header: 'Availability Period',
      accessor: 'availability',
      render: (row) => {
        const from = row.available_from ? new Date(row.available_from).toLocaleDateString() : 'Immediate';
        const until = row.available_until ? new Date(row.available_until).toLocaleDateString() : 'Permanent';
        return (
          <div className="flex flex-col text-[11px] text-slate-400">
            <span>From: <strong className="text-slate-300 font-normal">{from}</strong></span>
            <span>Until: <strong className="text-slate-300 font-normal">{until}</strong></span>
          </div>
        );
      },
    },
    {
      header: 'Rules & Policy',
      accessor: 'rules',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            title={row.allow_pause ? 'Pause permitted' : 'Pause not permitted'}
            className={`p-1 rounded ${row.allow_pause ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600 bg-slate-800'}`}
          >
            <PauseCircle className="h-3.5 w-3.5" />
          </span>
          <span
            title={row.allow_renewal ? 'Auto-renewal allowed' : 'No renewal'}
            className={`p-1 rounded ${row.allow_renewal ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-600 bg-slate-800'}`}
          >
            <Repeat className="h-3.5 w-3.5" />
          </span>
          <span
            title={row.auto_close ? 'Auto-close when expired' : 'Manual closure only'}
            className={`p-1 rounded ${row.auto_close ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 bg-slate-800'}`}
          >
            <Clock className="h-3.5 w-3.5" />
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'is_active',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            row.is_active
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Edit Plan"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors ${
              row.is_active
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
            title={row.is_active ? 'Deactivate Plan' : 'Activate Plan'}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setPlanToDelete(row);
              setShowDeleteModal(true);
            }}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            title="Delete / Deactivate Plan"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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

      {/* Header */}
      <PageHeader
        title="Subscription Plan Management"
        subtitle="Configure recurring billing cadences, availability windows, pause permissions, and product linkages"
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add New Plan
          </button>
        }
      />

      {/* Plan Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Layers}
          label="Total Configured Plans"
          value={pagination.total}
          trend={null}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Active Recurring Plans"
          value={plans.filter(p => p.is_active).length}
          trend={null}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={Package}
          label="Active Connected Products"
          value={products.length}
          trend={null}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />
        <StatCard
          icon={Clock}
          label="Expiring / Auto-Close"
          value={plans.filter(p => p.auto_close).length}
          trend={null}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1129]/80 border border-slate-800/80">
        <div className="relative w-full lg:w-72">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search plans by name, description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900/80 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Product Filter */}
          <select
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Billing Cycle Filter */}
          <select
            value={selectedCycle}
            onChange={(e) => {
              setSelectedCycle(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Billing Cycles</option>
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Plans Table */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner message="Loading subscription plans..." />
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
          <DataTable
            columns={columns}
            data={plans}
            emptyTitle="No subscription plans found"
            emptyDescription="Create your first recurring subscription plan to start accepting signups."
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total plans)
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
      {/* ADD / EDIT PLAN MODAL */}
      {/* ======================================================== */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                {modalMode === 'create' ? 'Create Subscription Plan' : 'Edit Subscription Plan'}
              </h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-5 overflow-y-auto space-y-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Product Offering *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${Number(p.sales_price).toFixed(2)})
                    </option>
                  ))}
                </select>
                {formErrors.product_id && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.product_id}</p>
                )}
              </div>

              {/* Plan Name & Billing Cycle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Pro Monthly Tier"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.name && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Billing Cycle *
                  </label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>{cycle}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price & Minimum Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Recurring Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="49.99"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {formErrors.price && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Minimum Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minimum_quantity}
                    onChange={(e) => setFormData({ ...formData, minimum_quantity: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {formErrors.minimum_quantity && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.minimum_quantity}</p>
                  )}
                </div>
              </div>

              {/* Availability Period Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Available From (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.available_from}
                    onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Available Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.available_until}
                    onChange={(e) => setFormData({ ...formData, available_until: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.available_until && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.available_until}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of plan benefits, terms and entitlements"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Subscription Rules & Policy Toggles */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <span className="text-xs font-semibold text-slate-200 block mb-1">
                  Subscription Policy Configuration
                </span>

                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allow_pause}
                    onChange={(e) => setFormData({ ...formData, allow_pause: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Allow subscribers to pause their recurring subscription</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allow_early_close}
                    onChange={(e) => setFormData({ ...formData, allow_early_close: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Allow early termination / cancellation prior to cycle end</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.allow_renewal}
                    onChange={(e) => setFormData({ ...formData, allow_renewal: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Allow automated recurring cycle renewal</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.auto_close}
                    onChange={(e) => setFormData({ ...formData, auto_close: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Enable Auto-Close upon reaching expiration date</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300 pt-1 border-t border-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span className="font-medium text-emerald-400">Plan is Active (Available for selection)</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
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
                  {modalMode === 'create' ? 'Create Plan' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {showDeleteModal && planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Remove Plan</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-white">"{planToDelete.name}"</span>?
              <br />
              <span className="text-slate-400 mt-2 block">
                Note: If existing subscribers are currently enrolled in this plan, it will be safely deactivated to maintain subscription billing continuity.
              </span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
