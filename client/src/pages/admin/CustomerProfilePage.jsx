import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Layers,
  FileText,
  CreditCard,
  ArrowLeft,
  ShieldCheck,
  Clock,
  ExternalLink
} from 'lucide-react';
import api from '../../services/api';

export const CustomerProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/customers/${id}`);
        if (res.data && res.data.success) {
          setCustomer(res.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Customer profile not found');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomer();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner message="Loading customer profile..." size="lg" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 max-w-md mx-auto text-xs">
          {error || 'Unable to load customer profile'}
        </div>
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
      {/* Back button & Header */}
      <div>
        <button
          onClick={() => navigate('/customers')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </button>
        <PageHeader
          title={customer.name}
          subtitle={`Account ID: #CUST-${customer.id} • Registered on ${new Date(customer.created_at).toLocaleDateString()}`}
        />
      </div>

      {/* Grid: Left Customer Info, Right Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-6 space-y-5 lg:col-span-1 h-fit">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-600/25">
              {(customer.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base leading-tight">{customer.name}</h3>
              <span className="text-xs text-slate-400 block mt-0.5">{customer.company_name || 'Individual Client'}</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border mt-2 capitalize ${
                  customer.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {customer.status}
              </span>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Email Address</span>
              <p className="text-slate-200 font-medium flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {customer.email}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Phone Number</span>
              <p className="text-slate-200 font-medium flex items-center gap-2 font-mono">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                {customer.phone || 'No phone recorded'}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Company / Organization</span>
              <p className="text-slate-200 font-medium flex items-center gap-2">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                {customer.company_name || 'Individual Account'}
              </p>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] mb-1">Billing Address</span>
              <p className="text-slate-200 font-medium flex items-start gap-2 leading-relaxed">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                {customer.address || 'No billing address provided'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Tabbed/Sections Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription History Section */}
          <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Layers className="h-4 w-4 text-indigo-400" />
                Active Subscriptions
              </div>
            </div>
            <EmptyState
              title="No active subscriptions found"
              description="Subscriptions created in future stages will appear here linked to this customer."
            />
          </div>

          {/* Invoice History Section */}
          <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileText className="h-4 w-4 text-violet-400" />
                Invoices & Statements
              </div>
            </div>
            <EmptyState
              title="No invoices on file"
              description="Automated billing invoices will be archived here once billing commences."
            />
          </div>

          {/* Payment History Section */}
          <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <CreditCard className="h-4 w-4 text-cyan-400" />
                Payment Transactions
              </div>
            </div>
            <EmptyState
              title="No payment records"
              description="Cleared payment gateway transactions will be logged in this ledger."
            />
          </div>
        </div>
      </div>
    </div>
  );
};
