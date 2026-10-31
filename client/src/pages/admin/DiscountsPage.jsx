import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  Edit2,
  Trash2,
  Power,
  RotateCw,
  X,
  Ticket,
  TrendingUp
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const STATUS_FILTERS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Expired', value: 'expired' }
];

const TYPE_FILTERS = [
  { label: 'All Types', value: 'all' },
  { label: 'Percentage (%)', value: 'percentage' },
  { label: 'Fixed Amount ($)', value: 'fixed' }
];

export const DiscountsPage = () => {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';

  const [discounts, setDiscounts] = useState([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    expired: 0,
    totalUsage: 0
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentDiscountId, setCurrentDiscountId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Test Coupon Modal State
  const [showTestModal, setShowTestModal] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testAmount, setTestAmount] = useState('100.00');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const initialFormState = {
    name: '',
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_purchase_amount: '0.00',
    max_discount_amount: '',
    start_date: new Date().toISOString().substring(0, 10),
    expiry_date: '',
    usage_limit: '',
    per_customer_limit: '1',
    is_active: 1
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await api.get(`/discounts?${params.toString()}`);
      if (res.data && res.data.success) {
        setDiscounts(res.data.data || []);
        if (res.data.metrics) {
          setMetrics(res.data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to load discounts', err);
      showNotification('error', err.response?.data?.message || 'Failed to fetch discounts');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDiscounts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDiscounts]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setCurrentDiscountId(null);
    setFormData(initialFormState);
    setFormErrors({});
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setModalMode('edit');
    setCurrentDiscountId(item.id);
    setFormData({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      type: item.type === 'fixed_amount' ? 'fixed' : item.type,
      value: item.value?.toString() || '',
      min_purchase_amount: item.min_purchase_amount?.toString() || '0.00',
      max_discount_amount: item.max_discount_amount?.toString() || '',
      start_date: item.start_date ? item.start_date.substring(0, 10) : '',
      expiry_date: item.expiry_date ? item.expiry_date.substring(0, 10) : '',
      usage_limit: item.usage_limit ? item.usage_limit.toString() : '',
      per_customer_limit: item.per_customer_limit ? item.per_customer_limit.toString() : '1',
      is_active: item.is_active ? 1 : 0
    });
    setFormErrors({});
    setShowModal(true);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Discount campaign name is required';
    if (!formData.code.trim()) errors.code = 'Coupon code is required';
    if (!formData.value || parseFloat(formData.value) <= 0) {
      errors.value = 'Discount value must be greater than 0';
    } else if (formData.type === 'percentage' && parseFloat(formData.value) > 100) {
      errors.value = 'Percentage discount cannot exceed 100%';
    }

    if (formData.start_date && formData.expiry_date) {
      if (new Date(formData.expiry_date) < new Date(formData.start_date)) {
        errors.expiry_date = 'Expiry date must be after or on start date';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        type: formData.type,
        value: parseFloat(formData.value),
        min_purchase_amount: parseFloat(formData.min_purchase_amount || 0),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        start_date: formData.start_date || null,
        expiry_date: formData.expiry_date || null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
        per_customer_limit: formData.per_customer_limit ? parseInt(formData.per_customer_limit, 10) : null,
        is_active: formData.is_active ? 1 : 0
      };

      if (modalMode === 'create') {
        const res = await api.post('/discounts', payload);
        if (res.data?.success) {
          showNotification('success', `Discount ${payload.code} created successfully!`);
          setShowModal(false);
          fetchDiscounts();
        }
      } else {
        const res = await api.put(`/discounts/${currentDiscountId}`, payload);
        if (res.data?.success) {
          showNotification('success', `Discount ${payload.code} updated successfully!`);
          setShowModal(false);
          fetchDiscounts();
        }
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save discount');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Discount Active Status
  const handleToggleStatus = async (item) => {
    try {
      const newStatus = item.is_active ? 0 : 1;
      const res = await api.put(`/discounts/${item.id}`, { is_active: newStatus });
      if (res.data?.success) {
        showNotification(
          'success',
          `Coupon ${item.code} is now ${newStatus ? 'Active' : 'Inactive'}`
        );
        fetchDiscounts();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Delete / Archive Discount
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to deactivate or remove coupon "${item.code}"?`)) {
      return;
    }
    try {
      const res = await api.delete(`/discounts/${item.id}`);
      if (res.data?.success) {
        showNotification('success', res.data.message || 'Discount deactivated successfully');
        fetchDiscounts();
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to remove discount');
    }
  };

  // Test Coupon Validation
  const handleTestValidate = async (e) => {
    e.preventDefault();
    if (!testCode.trim()) return;

    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.post('/discounts/validate', {
        code: testCode.trim().toUpperCase(),
        purchase_amount: parseFloat(testAmount || 0)
      });
      if (res.data?.success) {
        setTestResult({
          valid: true,
          ...res.data.data
        });
      }
    } catch (err) {
      setTestResult({
        valid: false,
        error: err.response?.data?.message || 'Coupon code is invalid'
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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

      {/* Page Header */}
      <PageHeader
        title="Discounts & Promotions"
        subtitle="Configure coupons, percentage promotions, fixed discounts, and enforce usage limits"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTestCode('');
                setTestResult(null);
                setShowTestModal(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Ticket className="h-4 w-4 text-indigo-400" />
              <span>Validate Coupon</span>
            </button>

            {isAdminOrStaff && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Create Discount</span>
              </button>
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Tag}
          label="Total Discounts"
          value={metrics.total.toString()}
          trendLabel="Configured promotions"
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Active Coupons"
          value={metrics.active.toString()}
          trendLabel="Ready for redemption"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={Clock}
          label="Expired Offers"
          value={metrics.expired.toString()}
          trendLabel="Past validity period"
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Redemptions"
          value={metrics.totalUsage.toString()}
          trendLabel="Customer usages"
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0f1129]/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search coupon code or campaign name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {TYPE_FILTERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchDiscounts()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh List"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Discounts Table */}
      <div className="bg-[#0f1129]/80 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner size="lg" message="Loading discount campaigns..." />
          </div>
        ) : discounts.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={Tag}
              title="No Discounts Found"
              description={
                searchTerm || selectedStatus !== 'all' || selectedType !== 'all'
                  ? 'No promotions match your search criteria. Try modifying your filters.'
                  : 'No discount coupons configured yet. Click "Create Discount" to launch your first promotion.'
              }
              actionLabel={isAdminOrStaff && !searchTerm ? 'Create Discount' : null}
              onAction={isAdminOrStaff && !searchTerm ? handleOpenCreate : null}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Campaign / Name</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Coupon Code</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px]">Type</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px]">Value</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Validity</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px] text-center">Usage Limit</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-[11px] text-center">Status</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {discounts.map((item) => {
                  const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
                  const isActive = item.is_active && !isExpired;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                      {/* Name & Description */}
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</p>
                          )}
                          {item.min_purchase_amount > 0 && (
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              Min purchase: ${Number(item.min_purchase_amount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Coupon Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 px-2.5 py-1 rounded-md tracking-wider">
                          {item.code}
                        </span>
                      </td>

                      {/* Discount Type */}
                      <td className="py-3.5 px-3">
                        <span className="capitalize text-slate-300 font-medium">
                          {item.type === 'percentage' ? 'Percentage' : 'Fixed'}
                        </span>
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-white">
                        {item.type === 'percentage'
                          ? `${Number(item.value)}% off`
                          : `$${Number(item.value).toFixed(2)} off`}
                        {item.max_discount_amount && (
                          <span className="block text-[10px] text-slate-400 font-sans">
                            Max: ${Number(item.max_discount_amount).toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Validity (Dates) */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span>
                            {item.start_date ? item.start_date.substring(0, 10) : 'Start'}
                            {' → '}
                            {item.expiry_date ? item.expiry_date.substring(0, 10) : 'No Expiry'}
                          </span>
                        </div>
                      </td>

                      {/* Usage Count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono text-xs text-slate-300 font-medium">
                          {item.used_count || 0}
                          {item.usage_limit ? ` / ${item.usage_limit}` : ' / ∞'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" />
                            Expired
                          </span>
                        ) : item.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Code */}
                          <button
                            onClick={() => {
                              setTestCode(item.code);
                              setTestResult(null);
                              setShowTestModal(true);
                            }}
                            title="Test this coupon"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Ticket className="h-4 w-4" />
                          </button>

                          {isAdminOrStaff && (
                            <>
                              {/* Toggle Active */}
                              <button
                                onClick={() => handleToggleStatus(item)}
                                title={item.is_active ? 'Deactivate Coupon' : 'Activate Coupon'}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  item.is_active
                                    ? 'text-emerald-400 hover:text-amber-400 hover:bg-slate-800'
                                    : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-800'
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEdit(item)}
                                title="Edit Discount"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(item)}
                                title="Deactivate / Delete"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT DISCOUNT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-400" />
                {modalMode === 'create' ? 'Create Promotional Discount' : `Edit Discount: ${formData.code}`}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Campaign Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Black Friday Special"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none ${
                      formErrors.name ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.name && <p className="text-[11px] text-rose-400">{formErrors.name}</p>}
                </div>

                {/* Coupon Code */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BFCM50"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white placeholder-slate-500 focus:outline-none uppercase ${
                      formErrors.code ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.code && <p className="text-[11px] text-rose-400">{formErrors.code}</p>}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Optional internal or promotional note"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Discount Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount Discount ($)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {formData.type === 'percentage' ? 'Percentage Off (%) *' : 'Amount Off ($) *'}
                  </label>
                  <input
                    type="number"
                    step={formData.type === 'percentage' ? '1' : '0.01'}
                    min="0.01"
                    placeholder={formData.type === 'percentage' ? '20' : '15.00'}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none ${
                      formErrors.value ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.value && <p className="text-[11px] text-rose-400">{formErrors.value}</p>}
                </div>
              </div>

              {/* Minimum Purchase & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Minimum Purchase Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.min_purchase_amount}
                    onChange={(e) => setFormData({ ...formData, min_purchase_amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Max Discount Cap ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional ceiling (e.g. 100.00)"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Start Date & Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none ${
                      formErrors.expiry_date ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                    }`}
                  />
                  {formErrors.expiry_date && (
                    <p className="text-[11px] text-rose-400">{formErrors.expiry_date}</p>
                  )}
                </div>
              </div>

              {/* Usage Limit & Customer Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Total Usage Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave blank for unlimited"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Per-Customer Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.per_customer_limit}
                    onChange={(e) => setFormData({ ...formData, per_customer_limit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Active Status Checkbox */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-xs font-medium text-slate-200 cursor-pointer">
                  Activate this discount immediately for redemption
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : modalMode === 'create'
                    ? 'Create Promotion'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST COUPON VALIDATION MODAL */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f1129] border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="h-5 w-5 text-indigo-400" />
                Live Coupon Engine Tester
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Test coupon validity, calculate exact percentage or fixed savings, and verify minimum purchase restrictions against live database rules.
            </p>

            <form onSubmit={handleTestValidate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Coupon Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. WELCOME10"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm rounded-xl p-3 uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Purchase Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-sm rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={testLoading || !testCode.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                {testLoading ? 'Validating against Database...' : 'Run Coupon Engine Test'}
              </button>
            </form>

            {/* Test Results Output */}
            {testResult && (
              <div
                className={`p-4 rounded-xl border space-y-2 mt-3 animate-in fade-in ${
                  testResult.valid
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  {testResult.valid ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>Valid Coupon: {testResult.code}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-400" />
                      <span>Validation Failed</span>
                    </>
                  )}
                </div>

                {testResult.valid ? (
                  <div className="text-xs space-y-1 font-mono">
                    <p className="text-slate-300 font-sans">{testResult.name}</p>
                    <div className="flex justify-between border-t border-emerald-800/50 pt-1.5">
                      <span className="text-slate-400 font-sans">Original Purchase:</span>
                      <span>${testResult.original_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span className="font-sans">Discount Savings:</span>
                      <span>-${testResult.discount_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-800/50 pt-1.5 text-white font-bold text-sm">
                      <span className="font-sans">Final Net Total:</span>
                      <span>${testResult.final_amount.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-rose-300">{testResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
