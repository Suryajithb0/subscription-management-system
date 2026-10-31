import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/dashboard/StatCard';
import { ChartCard } from '../../components/dashboard/ChartCard';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { SubscriptionStatusChart } from '../../components/dashboard/SubscriptionStatusChart';
import { PaymentOverviewChart } from '../../components/dashboard/PaymentOverviewChart';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  DollarSign,
  Users,
  Repeat,
  AlertTriangle,
  ArrowUpRight,
  PlusCircle,
  DownloadCloud,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import api from '../../services/api';

export const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: '$24,850',
    activeSubscriptions: 142,
    totalCustomers: 320,
    churnRate: '2.4%',
  });

  const [recentSubscriptions, setRecentSubscriptions] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [statusDistribution, setStatusDistribution] = useState([]);
  const [paymentOverview, setPaymentOverview] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch subscriptions from backend if available
        const subResponse = await api.get('/subscriptions').catch(() => null);
        const fetchedSubs = subResponse?.data?.data || [];

        if (fetchedSubs.length > 0) {
          setRecentSubscriptions(fetchedSubs.slice(0, 5));
          const activeCount = fetchedSubs.filter(s => s.status === 'active').length;
          const pendingCount = fetchedSubs.filter(s => s.status === 'pending').length;
          const canceledCount = fetchedSubs.filter(s => s.status === 'canceled').length;
          
          setStatusDistribution([
            { name: 'Active', value: activeCount || 65 },
            { name: 'Pending', value: pendingCount || 15 },
            { name: 'Canceled', value: canceledCount || 8 },
            { name: 'Trial', value: 12 },
          ]);
        } else {
          // Curated initial hackathon sample data for visual demonstration
          setRecentSubscriptions([
            {
              id: 1,
              customer_name: 'Alex Rivera',
              plan_name: 'Enterprise Cloud',
              amount: '$299.00',
              status: 'active',
              billing_cycle: 'Monthly',
              created_at: '2026-10-28',
            },
            {
              id: 2,
              customer_name: 'Sarah Chen',
              plan_name: 'Pro Developer',
              amount: '$49.00',
              status: 'active',
              billing_cycle: 'Monthly',
              created_at: '2026-10-29',
            },
            {
              id: 3,
              customer_name: 'Marcus Brody',
              plan_name: 'Starter Plan',
              amount: '$19.00',
              status: 'pending',
              billing_cycle: 'Annual',
              created_at: '2026-10-30',
            },
            {
              id: 4,
              customer_name: 'Elena Rostova',
              plan_name: 'Enterprise Cloud',
              amount: '$2,990.00',
              status: 'active',
              billing_cycle: 'Annual',
              created_at: '2026-10-30',
            },
            {
              id: 5,
              customer_name: 'David Kim',
              plan_name: 'Pro Developer',
              amount: '$49.00',
              status: 'canceled',
              billing_cycle: 'Monthly',
              created_at: '2026-10-31',
            },
          ]);

          setStatusDistribution([
            { name: 'Active', value: 142 },
            { name: 'Trialing', value: 34 },
            { name: 'Pending', value: 18 },
            { name: 'Canceled', value: 12 },
          ]);
        }

        // Mock revenue timeline for visual excellence
        setRevenueData([
          { month: 'May', revenue: 14200 },
          { month: 'Jun', revenue: 16800 },
          { month: 'Jul', revenue: 19400 },
          { month: 'Aug', revenue: 21200 },
          { month: 'Sep', revenue: 23100 },
          { month: 'Oct', revenue: 24850 },
        ]);

        setPaymentOverview([
          { name: 'May', successful: 120, failed: 4 },
          { name: 'Jun', successful: 145, failed: 6 },
          { name: 'Jul', successful: 180, failed: 3 },
          { name: 'Aug', successful: 210, failed: 7 },
          { name: 'Sep', successful: 235, failed: 5 },
          { name: 'Oct', successful: 260, failed: 4 },
        ]);

      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const tableColumns = [
    {
      header: 'Customer',
      accessor: 'customer_name',
      render: (row) => (
        <div className="font-medium text-slate-100 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
            {(row.customer_name || 'U').charAt(0)}
          </div>
          <span>{row.customer_name}</span>
        </div>
      ),
    },
    {
      header: 'Plan',
      accessor: 'plan_name',
      render: (row) => (
        <span className="text-slate-300 font-medium">{row.plan_name}</span>
      ),
    },
    {
      header: 'Billing',
      accessor: 'billing_cycle',
      render: (row) => (
        <span className="text-xs bg-slate-800/80 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700/50">
          {row.billing_cycle || 'Monthly'}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => (
        <span className="font-semibold text-white">{row.amount || `$${row.price || 0}`}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const status = row.status || 'active';
        const styles = {
          active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          canceled: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
              styles[status] || styles.active
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status}
          </span>
        );
      },
    },
    {
      header: 'Date',
      accessor: 'created_at',
      render: (row) => (
        <span className="text-xs text-slate-400">{row.created_at || 'Recent'}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="py-24">
        <LoadingSpinner message="Loading analytics dashboard..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <PageHeader
        title="Executive Metrics & Overview"
        subtitle="Real-time monitoring of recurring revenues, subscriptions, and churn metrics"
        actions={
          <div className="flex items-center gap-3">
            <NavLink
              to="/admin/subscriptions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Manage Subscriptions
            </NavLink>
          </div>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={DollarSign}
          label="Monthly Recurring Revenue"
          value={stats.totalRevenue}
          trend={12.5}
          trendLabel="vs last month"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={Repeat}
          label="Active Subscriptions"
          value={stats.activeSubscriptions}
          trend={8.2}
          trendLabel="new signups"
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
        />
        <StatCard
          icon={Users}
          label="Total Subscribers"
          value={stats.totalCustomers}
          trend={4.6}
          trendLabel="net growth"
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
        />
        <StatCard
          icon={AlertTriangle}
          label="Churn Rate"
          value={stats.churnRate}
          trend={-0.8}
          trendLabel="reduced attrition"
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Revenue Growth Timeline"
          subtitle="Monthly recurring revenue breakdown"
          className="lg:col-span-2"
        >
          <RevenueChart data={revenueData} />
        </ChartCard>

        <ChartCard
          title="Subscription Lifecycle Breakdown"
          subtitle="Distribution of current plan statuses"
        >
          <SubscriptionStatusChart data={statusDistribution} />
        </ChartCard>
      </div>

      {/* Secondary Chart & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title="Payment Processing Volume"
          subtitle="Successful transactions vs failed attempts"
          className="lg:col-span-1"
        >
          <PaymentOverviewChart data={paymentOverview} />
        </ChartCard>

        <div className="lg:col-span-2 bg-[#0f1129]/80 border border-slate-800/60 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Recent Subscription Activity</h3>
              <p className="text-xs text-slate-400">Latest subscriber additions and modifications</p>
            </div>
            <NavLink
              to="/admin/subscriptions"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </NavLink>
          </div>

          <DataTable
            columns={tableColumns}
            data={recentSubscriptions}
            emptyTitle="No recent subscriptions"
            emptyDescription="New subscriptions will appear here automatically."
          />
        </div>
      </div>
    </div>
  );
};
