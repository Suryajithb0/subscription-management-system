import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Power,
  Layers,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Tag
} from 'lucide-react';
import api from '../../services/api';

export const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Search, filter & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);
  const [variantsList, setVariantsList] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Delete / Deactivate confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Product Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    product_type: 'digital',
    sales_price: '',
    cost_price: '',
    notes: '',
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState({});

  // Variant Form state
  const [variantForm, setVariantForm] = useState({
    id: null,
    variant_name: '',
    variant_value: '',
    additional_price: '0',
    is_active: true,
  });
  const [editingVariantId, setEditingVariantId] = useState(null);

  const showNotification = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/products', {
        params: {
          search: searchTerm,
          product_type: selectedType,
          status: selectedStatus,
          page,
          limit: 10,
        },
      });
      if (response.data && response.data.success) {
        setProducts(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedType, selectedStatus, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Product Form Handlers
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSelectedProduct(null);
    setFormData({
      name: '',
      description: '',
      product_type: 'digital',
      sales_price: '',
      cost_price: '',
      notes: '',
      is_active: true,
    });
    setFormErrors({});
    setShowProductModal(true);
  };

  const handleOpenEditModal = (product) => {
    setModalMode('edit');
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      product_type: product.product_type || 'digital',
      sales_price: product.sales_price,
      cost_price: product.cost_price,
      notes: product.notes || '',
      is_active: Boolean(product.is_active),
    });
    setFormErrors({});
    setShowProductModal(true);
  };

  const validateProductForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Product name is required.';
    if (formData.sales_price === '' || isNaN(formData.sales_price) || Number(formData.sales_price) < 0) {
      errors.sales_price = 'Sales price must be 0 or higher.';
    }
    if (formData.cost_price === '' || isNaN(formData.cost_price) || Number(formData.cost_price) < 0) {
      errors.cost_price = 'Cost price must be 0 or higher.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;

    setActionLoading(true);
    try {
      if (modalMode === 'create') {
        await api.post('/products', formData);
        showNotification('success', 'Product created successfully.');
      } else {
        await api.put(`/products/${selectedProduct.id}`, formData);
        showNotification('success', 'Product updated successfully.');
      }
      setShowProductModal(false);
      fetchProducts();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save product');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Status Handler
  const handleToggleStatus = async (product) => {
    try {
      const nextStatus = !product.is_active;
      await api.patch(`/products/${product.id}/status`, { is_active: nextStatus });
      showNotification('success', `Product ${nextStatus ? 'activated' : 'deactivated'}.`);
      fetchProducts();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to update status');
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/products/${productToDelete.id}`);
      showNotification('success', res.data?.message || 'Product removed.');
      setShowDeleteModal(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to remove product');
    } finally {
      setActionLoading(false);
    }
  };

  // Variant Modal Handlers
  const handleOpenVariantsModal = async (product) => {
    setVariantProduct(product);
    setShowVariantModal(true);
    setEditingVariantId(null);
    setVariantForm({
      id: null,
      variant_name: '',
      variant_value: '',
      additional_price: '0',
      is_active: true,
    });
    fetchVariants(product.id);
  };

  const fetchVariants = async (productId) => {
    setVariantsLoading(true);
    try {
      const res = await api.get(`/products/${productId}/variants`);
      if (res.data && res.data.success) {
        setVariantsList(res.data.data);
      }
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to fetch variants');
    } finally {
      setVariantsLoading(false);
    }
  };

  const handleSaveVariant = async (e) => {
    e.preventDefault();
    if (!variantForm.variant_name.trim() || !variantForm.variant_value.trim()) {
      showNotification('error', 'Please fill in both variant name and value');
      return;
    }

    try {
      if (editingVariantId) {
        await api.put(`/products/${variantProduct.id}/variants/${editingVariantId}`, variantForm);
        showNotification('success', 'Variant updated.');
      } else {
        await api.post(`/products/${variantProduct.id}/variants`, variantForm);
        showNotification('success', 'Variant added.');
      }
      setEditingVariantId(null);
      setVariantForm({
        id: null,
        variant_name: '',
        variant_value: '',
        additional_price: '0',
        is_active: true,
      });
      fetchVariants(variantProduct.id);
      fetchProducts(); // update count
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to save variant');
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    try {
      await api.delete(`/products/${variantProduct.id}/variants/${variantId}`);
      showNotification('success', 'Variant removed.');
      fetchVariants(variantProduct.id);
      fetchProducts();
    } catch (err) {
      showNotification('error', err.response?.data?.message || 'Failed to delete variant');
    }
  };

  // Calculate profit margin
  const getMargin = (sales, cost) => {
    const s = Number(sales) || 0;
    const c = Number(cost) || 0;
    if (s <= 0) return { margin: 0, percent: '0%' };
    const diff = s - c;
    const pct = ((diff / s) * 100).toFixed(1);
    return {
      margin: diff.toFixed(2),
      percent: `${pct}%`,
      positive: diff >= 0,
    };
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Product Name',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{row.name}</p>
            <p className="text-xs text-slate-400 truncate max-w-xs">{row.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Product Type',
      accessor: 'product_type',
      render: (row) => (
        <span className="text-xs bg-slate-800/80 text-indigo-300 font-medium px-2.5 py-1 rounded-md border border-slate-700/60 capitalize">
          {row.product_type}
        </span>
      ),
    },
    {
      header: 'Sales Price',
      accessor: 'sales_price',
      render: (row) => (
        <span className="font-semibold text-white text-sm">
          ${Number(row.sales_price).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Cost Price',
      accessor: 'cost_price',
      render: (row) => (
        <span className="text-xs text-slate-400 font-mono">
          ${Number(row.cost_price).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Profit Margin',
      accessor: 'margin',
      render: (row) => {
        const { margin, percent, positive } = getMargin(row.sales_price, row.cost_price);
        return (
          <div className="flex flex-col">
            <span className={`text-xs font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${margin}
            </span>
            <span className="text-[10px] text-slate-400">({percent})</span>
          </div>
        );
      },
    },
    {
      header: 'Variants',
      accessor: 'variants_count',
      render: (row) => (
        <button
          onClick={() => handleOpenVariantsModal(row)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
        >
          <Layers className="h-3 w-3" />
          <span>{row.variants_count || 0} Variants</span>
        </button>
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
      header: 'Created Date',
      accessor: 'created_at',
      render: (row) => (
        <span className="text-xs text-slate-400">
          {new Date(row.created_at).toLocaleDateString()}
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
            title="Edit Product"
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
            title={row.is_active ? 'Deactivate Product' : 'Activate Product'}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setProductToDelete(row);
              setShowDeleteModal(true);
            }}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            title="Delete / Deactivate"
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

      {/* Page Header */}
      <PageHeader
        title="Product & Service Catalog"
        subtitle="Manage subscribable offerings, cost structures, and customized tier variants"
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        }
      />

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1129]/80 border border-slate-800/80">
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by product name, notes..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900/80 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900/80 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="digital">Digital</option>
              <option value="service">Service</option>
              <option value="software">Software</option>
              <option value="physical">Physical</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
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
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner message="Loading product catalog..." />
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
          <DataTable
            columns={columns}
            data={products}
            emptyTitle="No products found"
            emptyDescription="Create your first product to begin offering subscriptions."
          />

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/60 text-xs text-slate-400">
              <span>
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total products)
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
      {/* ADD / EDIT PRODUCT MODAL */}
      {/* ======================================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white">
                {modalMode === 'create' ? 'Add New Product' : 'Edit Product'}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Business Software"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
                {formErrors.name && (
                  <p className="text-rose-400 text-[11px] mt-1">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Product Type
                  </label>
                  <select
                    value={formData.product_type}
                    onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="digital">Digital</option>
                    <option value="software">Software</option>
                    <option value="service">Service</option>
                    <option value="physical">Physical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.is_active ? '1' : '0'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === '1' })}
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sales Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sales_price}
                    onChange={(e) => setFormData({ ...formData, sales_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.sales_price && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.sales_price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cost Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                  {formErrors.cost_price && (
                    <p className="text-rose-400 text-[11px] mt-1">{formErrors.cost_price}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description of the product or service"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Internal Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Administrative notes, vendor info, SKU references"
                  className="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
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
                  {modalMode === 'create' ? 'Create Product' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VARIANTS MANAGEMENT MODAL */}
      {/* ======================================================== */}
      {showVariantModal && variantProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Product Variants: {variantProduct.name}
                </h3>
                <p className="text-xs text-indigo-400 font-mono">
                  Base Price: ${Number(variantProduct.sales_price).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowVariantModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Variant creation / edit sub-form */}
              <form onSubmit={handleSaveVariant} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                <span className="text-xs font-semibold text-slate-200 block">
                  {editingVariantId ? 'Edit Selected Variant' : 'Add New Variant Option'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Variant Type (e.g. Brand, Tier)</label>
                    <input
                      type="text"
                      placeholder="Brand"
                      value={variantForm.variant_name}
                      onChange={(e) => setVariantForm({ ...variantForm, variant_name: e.target.value })}
                      className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Value (e.g. Odoo, Zoho)</label>
                    <input
                      type="text"
                      placeholder="Odoo"
                      value={variantForm.variant_value}
                      onChange={(e) => setVariantForm({ ...variantForm, variant_value: e.target.value })}
                      className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Additional Fee ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={variantForm.additional_price}
                      onChange={(e) => setVariantForm({ ...variantForm, additional_price: e.target.value })}
                      className="w-full bg-slate-900 text-white text-xs rounded-lg px-3 py-2 border border-slate-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-[11px] text-slate-400">
                    Final Price preview:{' '}
                    <span className="text-emerald-400 font-bold">
                      ${(Number(variantProduct.sales_price) + (Number(variantForm.additional_price) || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingVariantId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVariantId(null);
                          setVariantForm({
                            id: null,
                            variant_name: '',
                            variant_value: '',
                            additional_price: '0',
                            is_active: true,
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                    >
                      {editingVariantId ? 'Update Variant' : 'Add Variant'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Variants list table */}
              {variantsLoading ? (
                <LoadingSpinner message="Loading variants..." size="sm" />
              ) : variantsList.length === 0 ? (
                <EmptyState
                  title="No variants configured"
                  description="Add options like brands, tiers or configurations above."
                />
              ) : (
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Variant Type</th>
                        <th className="py-2.5 px-3">Option Value</th>
                        <th className="py-2.5 px-3">Add-on Price</th>
                        <th className="py-2.5 px-3">Final Effective Price</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {variantsList.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-medium text-white">{v.variant_name}</td>
                          <td className="py-2.5 px-3 text-indigo-300">{v.variant_value}</td>
                          <td className="py-2.5 px-3 font-mono">+${Number(v.additional_price).toFixed(2)}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400 font-mono">
                            ${Number(v.final_price || Number(variantProduct.sales_price) + Number(v.additional_price)).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingVariantId(v.id);
                                  setVariantForm({
                                    id: v.id,
                                    variant_name: v.variant_name,
                                    variant_value: v.variant_value,
                                    additional_price: v.additional_price,
                                    is_active: Boolean(v.is_active),
                                  });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                                title="Edit"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteVariant(v.id)}
                                className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowVariantModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE / DEACTIVATE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0f1129] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-semibold text-white text-sm">Remove Product</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-white">"{productToDelete.name}"</span>?
              <br />
              <span className="text-slate-400 mt-2 block">
                Note: If this product has historical customer subscriptions or quotes, it will be safely deactivated to preserve accounting records.
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
