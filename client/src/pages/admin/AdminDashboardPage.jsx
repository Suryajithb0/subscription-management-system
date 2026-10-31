import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/dashboard/StatCard';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { SubscriptionStatusChart } from '../../components/dashboard/SubscriptionStatusChart';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  DollarSign,
  Users,
  Repeat,
  Package,
  FileText,
  Clock,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  PlusCircle,
  RotateCw,
  Wallet,
  Receipt,
  Calendar,
  AlertCircle,
  PieChart as PieChartIcon,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const INVOICE_COLORS = ['#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#64748b'];
const METHOD_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

export const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [analytics, setAnalytics] = useState(null);
  const [activeRecentTab, setActiveRecentTab] = useState('payments'); // 'payments' | 'invoices' | 'subscriptions'

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.get('/dashboard/analytics');
      if (res.data && res.data.success) {
        setAnalytics(res.data.data);
      } else {
        setError('Failed to load dashboard metrics');
      }
    } catch (err) {
      console.error('Failed to load dashboard analytics', err);
      setError(err.response?.data?.message || 'Failed to connect to database analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center">
        <LoadingSpinner message="Calculating real-time database metrics..." size="lg" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="py-16">
        <EmptyState
          icon={AlertCircle}
          title="Analytics Unavailable"
          description={error || "Could not retrieve real database analytics. Check backend service status."}
          actionLabel="Retry Analytics"
          onAction={() => fetchAnalytics()}
        />
      </div>
    );
  }

  const { summary, charts, recentActivity, additional } = analytics;

  // Format currency helper
  const fmt = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Table Columns for Recent Payments
  const paymentColumns = [
    {
      header: 'Payment ID',
      accessor: 'payment_number',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-indigo-300">
          {row.payment_number || `PAY-${row.id}`}
        </span>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row) => (
        <div className="font-medium text-slate-100 flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
            {(row.customer_name || 'U').charAt(0)}
          </div>
          <span className="truncate max-w-[120px]">{row.customer_name}</span>
        </div>
      ),
    },
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (row) => (
        <NavLink
          to={`/invoices/${row.invoice_id}`}
          className="font-mono text-xs text-slate-300 hover:text-indigo-400 underline"
        >
          {row.invoice_number}
        </NavLink>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-400">{fmt(row.amount)}</span>
      ),
    },
    {
      header: 'Method',
      accessor: 'payment_method',
      render: (row) => (
        <span className="capitalize text-xs text-slate-300">
          {(row.payment_method || 'card').replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const s = (row.status || 'completed').toLowerCase();
        const styles = {
          completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          refunded: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[s] || styles.completed}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {s}
          </span>
        );
      },
    },
    {
      header: 'Date',
      accessor: 'payment_date',
      render: (row) => (
        <span className="text-xs text-slate-400">{row.payment_date ? row.payment_date.substring(0, 10) : 'Recent'}</span>
      ),
    },
  ];

  // Table Columns for Recent Invoices
  const invoiceColumns = [
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (row) => (
        <NavLink
          to={`/invoices/${row.id}`}
          className="font-mono text-xs font-bold text-indigo-300 hover:text-indigo-200 underline"
        >
          {row.invoice_number}
        </NavLink>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row) => (
        <span className="text-xs text-slate-200 font-medium">{row.customer_name}</span>
      ),
    },
    {
      header: 'Total',
      accessor: 'total',
      render: (row) => (
        <span className="font-mono font-bold text-white">{fmt(row.total)}</span>
      ),
    },
    {
      header: 'Balance Due',
      accessor: 'balance_due',
      render: (row) => (
        <span className={`font-mono text-xs font-bold ${Number(row.balance_due) > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
          {fmt(row.balance_due)}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const s = (row.status || 'open').toLowerCase();
        const styles = {
          paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          partially_paid: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          open: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          overdue: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[s] || styles.open}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {s.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      header: 'Due Date',
      accessor: 'due_date',
      render: (row) => (
        <span className="text-xs text-slate-400">{row.due_date ? row.due_date.substring(0, 10) : '—'}</span>
      ),
    },
  ];

  // Table Columns for Recent Subscriptions
  const subscriptionColumns = [
    {
      header: 'Subscription #',
      accessor: 'subscription_number',
      render: (row) => (
        <NavLink
          to={`/subscriptions/${row.id}`}
          className="font-mono text-xs font-bold text-indigo-300 hover:text-indigo-200 underline"
        >
          {row.subscription_number || `SUB-${row.id}`}
        </NavLink>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row) => (
        <span className="text-xs text-slate-200 font-medium">{row.customer_name}</span>
      ),
    },
    {
      header: 'Plan',
      accessor: 'plan_name',
      render: (row) => (
        <span className="text-xs text-slate-300 font-medium">{row.plan_name}</span>
      ),
    },
    {
      header: 'Cycle',
      accessor: 'billing_cycle',
      render: (row) => (
        <span className="capitalize text-xs text-slate-400">{row.billing_cycle || 'Monthly'}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const s = (row.status || 'active').toLowerCase();
        const styles = {
          active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          canceled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          expired: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[s] || styles.active}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <PageHeader
        title="Executive Metrics & Overview"
        subtitle="100% Real-time database telemetry: revenue collection, subscriptions, invoices & cashflow"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Refresh database telemetry"
            >
              <RotateCw className={`h-4 w-4 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <NavLink
              to="/payments"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <CreditCard className="h-4 w-4" />
              <span>Payment Hub</span>
            </NavLink>
          </div>
        }
      />

      {/* Financial Health Highlights / Outstanding Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Outstanding Receivables */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/40 border border-amber-500/30 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Outstanding Invoice Receivables
            </span>
            <p className="text-xl font-mono font-black text-amber-200">
              {fmt(summary.outstandingBalances)}
            </p>
            <p className="text-[10px] text-slate-400">
              Pending collection across active invoices
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Collected vs Invoiced */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-900/40 border border-emerald-500/30 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Cash Realization Rate
            </span>
            <p className="text-xl font-mono font-black text-emerald-200">
              {summary.invoicedRevenue > 0
                ? `${((summary.collectedRevenue / summary.invoicedRevenue) * 100).toFixed(1)}%`
                : '100%'}
            </p>
            <p className="text-[10px] text-slate-400">
              {fmt(summary.collectedRevenue)} collected of {fmt(summary.invoicedRevenue)} invoiced
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Failed Payments Alert */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between ${
          summary.failedPaymentsCount > 0
            ? 'bg-rose-950/30 border-rose-500/40'
            : 'bg-slate-900/60 border-slate-800'
        }`}>
          <div className="space-y-0.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              summary.failedPaymentsCount > 0 ? 'text-rose-400' : 'text-slate-400'
            }`}>
              Failed Transactions
            </span>
            <p className={`text-xl font-mono font-black ${
              summary.failedPaymentsCount > 0 ? 'text-rose-300' : 'text-slate-300'
            }`}>
              {summary.failedPaymentsCount} Attempt{summary.failedPaymentsCount === 1 ? '' : 's'}
            </p>
            <p className="text-[10px] text-slate-400">
              {summary.failedPaymentsCount > 0
                ? 'Requires dunning or customer follow-up'
                : 'Zero failed attempts recorded'}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            summary.failedPaymentsCount > 0
              ? 'bg-rose-500/20 text-rose-400'
              : 'bg-slate-800 text-slate-500'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 8 Primary Required Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Revenue (Collected) */}
        <StatCard
          icon={DollarSign}
          label="Total Collected Revenue"
          value={fmt(summary.collectedRevenue)}
          trendLabel="Excludes failed/pending"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />

        {/* Total Customers */}
        <StatCard
          icon={Users}
          label="Total Customers"
          value={summary.totalCustomers.toString()}
          trendLabel="Registered client accounts"
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />

        {/* Active Subscriptions */}
        <StatCard
          icon={Repeat}
          label="Active Subscriptions"
          value={summary.activeSubscriptions.toString()}
          trendLabel="Recurring active services"
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />

        {/* Total Products */}
        <StatCard
          icon={Package}
          label="Total Products"
          value={summary.totalProducts.toString()}
          trendLabel="Catalog catalog offerings"
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10"
        />

        {/* Total Invoices */}
        <StatCard
          icon={Receipt}
          label="Total Invoices"
          value={summary.totalInvoices.toString()}
          trendLabel="Generated billing records"
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10"
        />

        {/* Pending Invoices */}
        <StatCard
          icon={Clock}
          label="Pending Invoices"
          value={summary.pendingInvoices.toString()}
          trendLabel="Awaiting settlement"
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />

        {/* Overdue Invoices */}
        <StatCard
          icon={AlertCircle}
          label="Overdue Invoices"
          value={summary.overdueInvoices.toString()}
          trendLabel="Past due payment grace"
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />

        {/* Total Payments */}
        <StatCard
          icon={CreditCard}
          label="Total Payments"
          value={summary.totalPayments.toString()}
          trendLabel="Processed transactions"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
      </div>

      {/* Analytics Charts Grid: Revenue & Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Monthly Realized Revenue"
          subtitle="Collected payments aggregated from database records"
          className="lg:col-span-2"
        >
          <RevenueChart data={charts.monthlyRevenue} />
        </ChartCard>

        <ChartCard
          title="Subscription Distribution"
          subtitle="Active, pending and canceled lifecycle breakdown"
        >
          <SubscriptionStatusChart data={charts.subscriptionStatusDistribution} />
        </ChartCard>
      </div>

      {/* Secondary Charts: Payment Methods & Invoice Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments by Method Chart */}
        <ChartCard
          title="Payments by Method"
          subtitle="Distribution of payment channels recorded in MySQL"
        >
          {charts.paymentMethods && charts.paymentMethods.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.paymentMethods} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => val.replace('_', ' ').toUpperCase()}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const it = payload[0].payload;
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-slate-400 mb-1 capitalize">{label?.replace('_', ' ')}</p>
                        <p className="text-sm font-bold text-white">{it.value} Transaction(s)</p>
                        <p className="text-xs font-mono text-emerald-400">Total: ${Number(it.total_amount || 0).toFixed(2)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Transactions">
                  {charts.paymentMethods.map((_, i) => (
                    <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={CreditCard}
              title="No Payment Data"
              description="Record payments to populate channel analytics."
            />
          )}
        </ChartCard>

        {/* Invoice Status Distribution */}
        <ChartCard
          title="Invoice Status Breakdown"
          subtitle="Settlement status across generated invoices"
        >
          {charts.invoiceStatusDistribution && charts.invoiceStatusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={charts.invoiceStatusDistribution}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {charts.invoiceStatusDistribution.map((_, i) => (
                    <Cell key={i} fill={INVOICE_COLORS[i % INVOICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
                        <p className="text-xs text-slate-400 capitalize">{payload[0].name?.replace('_', ' ')}</p>
                        <p className="text-sm font-semibold text-white">{payload[0].value} Invoice(s)</p>
                      </div>
                    );
                  }}
                />
                <Legend
                  content={({ payload }) => (
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                      {payload?.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-slate-400 capitalize">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.value?.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={FileText}
              title="No Invoices Recorded"
              description="Invoice breakdown will appear as invoices are created."
            />
          )}
        </ChartCard>
      </div>

      {/* Recent Activity Multi-tab Table Section */}
      <div className="bg-[#0f1129]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Live Database Activity Stream
            </h3>
            <p className="text-xs text-slate-400">
              Direct feed of latest payments, billings, and customer subscriptions
            </p>
          </div>

          {/* Activity Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveRecentTab('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeRecentTab === 'payments'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Recent Payments ({recentActivity.recentPayments?.length || 0})
            </button>
            <button
              onClick={() => setActiveRecentTab('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeRecentTab === 'invoices'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Recent Invoices ({recentActivity.recentInvoices?.length || 0})
            </button>
            <button
              onClick={() => setActiveRecentTab('subscriptions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeRecentTab === 'subscriptions'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Subscriptions ({recentActivity.recentSubscriptions?.length || 0})
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        {activeRecentTab === 'payments' && (
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Latest Processed Transactions
              </span>
              <NavLink to="/payments" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                View All Payments <ArrowUpRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
            <DataTable
              columns={paymentColumns}
              data={recentActivity.recentPayments || []}
              emptyTitle="No recent payments"
              emptyDescription="Recorded payments will appear here in real-time."
            />
          </div>
        )}

        {activeRecentTab === 'invoices' && (
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Latest Customer Invoices
              </span>
              <NavLink to="/invoices" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                View All Invoices <ArrowUpRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
            <DataTable
              columns={invoiceColumns}
              data={recentActivity.recentInvoices || []}
              emptyTitle="No recent invoices"
              emptyDescription="Newly generated invoices will appear here."
            />
          </div>
        )}

        {activeRecentTab === 'subscriptions' && (
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Subscriber Registrations
              </span>
              <NavLink to="/subscriptions" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                View All Subscriptions <ArrowUpRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
            <DataTable
              columns={subscriptionColumns}
              data={recentActivity.recentSubscriptions || []}
              emptyTitle="No recent subscriptions"
              emptyDescription="Subscribers will be listed once signed up."
            />
          </div>
        )}
      </div>
    </div>
  );
};
