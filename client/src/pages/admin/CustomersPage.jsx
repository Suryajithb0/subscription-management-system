import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  Users,
  UserCheck,
  UserPlus,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  Power,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar
} from 'lucide-react';
import api from '../../services/api';

export const CustomersPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, active: 0, new30Days: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Deactivate / Archive Confirmation Modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [customerToDeactivate, setCustomerToDeactivate] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
  });
  const [formErrors, setFormErrors] = useState({});

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/customers', {
        params: {
          search: searchTerm,
          status: selectedStatus,
          page,
          limit: 10,
        },
      });
      if (response.data && response.data.success) {
        setCustomers(response.data.data);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
        setPagination(response.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, page]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Form Handlers
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingCustomer(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      address: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEditModal = (customer) => {
    setModalMode('edit');
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      company_name: customer.company_name || '',
      address: customer.address || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required.';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please provide a valid email format.';
      }
    }
    if (formData.phone && formData.phone.trim().length < 7) {
      errors.phone = 'Phone number must have at least 7 digits.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setActionLoading(true);
    try {
      if (modalMode === 'create') {
        await api.post('/customers', formData);
        showNotification('success', 'Customer record created successfully.');
      } else {
        await api.put(`/customers/${editingCustomer.id}`, formData);
        showNotification('success', 'Customer record updated successfully.');
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (customer) => {
    try {
      const nextStatus = customer.status === 'active' ? 'inactive' : 'active';
      await api.patch(`/customers/${customer.id}/status`, { status: nextStatus });
      showNotification('success', `Customer status set to ${nextStatus}.`);
      fetchCustomers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to update customer status');
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!customerToDeactivate) return;
    setActionLoading(true);
    try {
      await api.patch(`/customers/${customerToDeactivate.id}/status`, { status: 'inactive' });
      showNotification('success', 'Customer successfully deactivated.');
      setShowDeactivateModal(false);
      setCustomerToDeactivate(null);
      fetchCustomers();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to deactivate customer');
    } finally {
      setActionLoading(false);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Customer Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 text-xs shrink-0">
            {(row.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <button
              onClick={() => navigate(`/customers/${row.id}`)}
              className="font-semibold text-white text-sm hover:text-indigo-300 text-left truncate block transition-colors"
            >
              {row.name}
            </button>
            <p className="text-xs text-slate-400 truncate max-w-xs">{row.company_name || 'Individual'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Email',
      accessor: 'email',
      render: (row) => (
        <span className="text-xs text-slate-300 flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-slate-400" />
          {row.email}
        </span>
      ),
    },
    {
      header: 'Phone',
      accessor: 'phone',
      render: (row) => (
        <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
          <Phone className="h-3.5 w-3.5 text-slate-500" />
          {row.phone || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Company',
      accessor: 'company_name',
      render: (row) => (
        <span className="text-xs text-slate-300 flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5 text-indigo-400/70" />
          {row.company_name || 'Individual'}
        </span>
      ),
    },
    {
      header: 'Registration Date',
      accessor: 'created_at',
      render: (row) => (
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const statusColors = {
          active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          inactive: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          archived: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
              statusColors[row.status] || statusColors.active
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
            onClick={() => navigate(`/customers/${row.id}`)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Edit Customer"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setCustomerToDeactivate(row);
              setShowDeactivateModal(true);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              row.status === 'active'
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
            title={row.status === 'active' ? 'Deactivate Customer' : 'Activate Customer'}
          >
            <Power className="h-3.5 w-3.5" />
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

      {/* Page Header */}
      <PageHeader
        title="Customers"
        subtitle="Manage customer information and subscription relationships."
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          icon={Users}
          label="Total Customers"
          value={metrics.total}
          trend={null}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          icon={UserCheck}
          label="Active Customers"
          value={metrics.active}
          trend={null}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={UserPlus}
          label="New Customers (Last 30 Days)"
          value={metrics.new30Days}
          trend={null}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1129]/80 border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, company..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900/80 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
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
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Main Customers Table */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner message="Loading customer directory..." />
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
          <DataTable
            columns={columns}
            data={customers}
            emptyTitle="No customers found"
            emptyDescription="Add your first customer to begin managing accounts."
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total customers)
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
      {/* ADD / EDIT CUSTOMER MODAL */}
      {/* ======================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                {modalMode === 'create' ? 'Add New Customer' : 'Edit Customer Record'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Morgan"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
                {formErrors.name && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.email && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.phone && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Acme Corp (leave blank for individual)"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Billing / Physical Address
                </label>
                <textarea
                  rows="2"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, State, Postal Code, Country"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {modalMode === 'create' ? 'Create Customer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DEACTIVATE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {showDeactivateModal && customerToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Deactivate Customer</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to deactivate <span className="font-semibold text-white">"{customerToDeactivate.name}"</span>?
              <br />
              <span className="text-slate-400 mt-2 block">
                Historical invoices, payments, and subscription records will remain securely archived in the system.
              </span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
