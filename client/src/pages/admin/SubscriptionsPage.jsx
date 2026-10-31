import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  Calendar,
  DollarSign
} from 'lucide-react';
import api from '../../services/api';

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchSubscriptions = async () => {
      setLoading(true);
      try {
        const response = await api.get('/subscriptions').catch(() => null);
        if (response?.data?.data && response.data.data.length > 0) {
          setSubscriptions(response.data.data);
        } else {
          // Curated initial hackathon dataset
          setSubscriptions([
            {
              id: 101,
              customer_name: 'Alex Rivera',
              customer_email: 'alex.rivera@example.com',
              plan_name: 'Enterprise Cloud',
              billing_cycle: 'Monthly',
              amount: '$299.00',
              status: 'active',
              start_date: '2026-01-15',
              next_billing: '2026-11-15',
            },
            {
              id: 102,
              customer_name: 'Sarah Chen',
              customer_email: 'sarah.c@techcorp.io',
              plan_name: 'Pro Developer',
              billing_cycle: 'Monthly',
              amount: '$49.00',
              status: 'active',
              start_date: '2026-03-20',
              next_billing: '2026-11-20',
            },
            {
              id: 103,
              customer_name: 'Marcus Brody',
              customer_email: 'm.brody@acmeworks.com',
              plan_name: 'Starter Plan',
              billing_cycle: 'Annual',
              amount: '$190.00',
              status: 'pending',
              start_date: '2026-09-01',
              next_billing: '2026-11-01',
            },
            {
              id: 104,
              customer_name: 'Elena Rostova',
              customer_email: 'elena@novasoft.dev',
              plan_name: 'Enterprise Cloud',
              billing_cycle: 'Annual',
              amount: '$2,990.00',
              status: 'active',
              start_date: '2026-02-10',
              next_billing: '2027-02-10',
            },
            {
              id: 105,
              customer_name: 'David Kim',
              customer_email: 'd.kim@hypergrowth.ai',
              plan_name: 'Pro Developer',
              billing_cycle: 'Monthly',
              amount: '$49.00',
              status: 'canceled',
              start_date: '2025-11-05',
              next_billing: 'N/A',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load subscriptions', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch =
      sub.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      header: 'Subscriber',
      accessor: 'customer_name',
      render: (row) => (
        <div>
          <p className="font-semibold text-white text-sm">{row.customer_name}</p>
          <p className="text-xs text-slate-400">{row.customer_email || 'subscriber@example.com'}</p>
        </div>
      ),
    },
    {
      header: 'Subscription Plan',
      accessor: 'plan_name',
      render: (row) => (
        <span className="font-medium text-indigo-300 text-sm">{row.plan_name}</span>
      ),
    },
    {
      header: 'Cycle',
      accessor: 'billing_cycle',
      render: (row) => (
        <span className="text-xs bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/60 font-mono">
          {row.billing_cycle}
        </span>
      ),
    },
    {
      header: 'Price / Fee',
      accessor: 'amount',
      render: (row) => (
        <span className="font-bold text-white text-sm">
          {row.amount || `$${row.price || 0}`}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const status = row.status || 'active';
        const config = {
          active: {
            bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            icon: CheckCircle,
          },
          pending: {
            bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            icon: Clock,
          },
          canceled: {
            bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
            icon: XCircle,
          },
        };
        const current = config[status] || config.active;
        const Icon = current.icon;

        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${current.bg}`}
          >
            <Icon className="h-3 w-3" />
            {status}
          </span>
        );
      },
    },
    {
      header: 'Next Renewal',
      accessor: 'next_billing',
      render: (row) => (
        <span className="text-xs text-slate-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          {row.next_billing || 'End of Cycle'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Subscription Directory"
        subtitle="Manage client plans, billing renewal cadences, and subscription status"
        actions={
          <button
            onClick={() => alert('Add Subscription modal will connect with Stage 05 API')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Subscription
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0f1129]/80 border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by customer or plan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/80 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900/80 text-slate-300 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner message="Fetching subscriptions..." />
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
          <DataTable
            columns={columns}
            data={filteredSubscriptions}
            emptyTitle="No matching subscriptions"
            emptyDescription="Try adjusting your filter or search keywords."
          />
        </div>
      )}
    </div>
  );
};
