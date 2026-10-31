import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable } from '../../components/common/DataTable';
import { StatCard } from '../../components/dashboard/StatCard';
import {
  CreditCard,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Receipt
} from 'lucide-react';

export const BillingPage = () => {
  const [invoices] = useState([
    {
      id: 'INV-2026-001',
      customer: 'Alex Rivera',
      amount: '$299.00',
      date: '2026-10-15',
      method: 'MasterCard •••• 4242',
      status: 'paid',
    },
    {
      id: 'INV-2026-002',
      customer: 'Sarah Chen',
      amount: '$49.00',
      date: '2026-10-20',
      method: 'Visa •••• 8891',
      status: 'paid',
    },
    {
      id: 'INV-2026-003',
      customer: 'Marcus Brody',
      amount: '$190.00',
      date: '2026-10-25',
      method: 'PayPal (m.brody@acme)',
      status: 'pending',
    },
    {
      id: 'INV-2026-004',
      customer: 'Elena Rostova',
      amount: '$2,990.00',
      date: '2026-10-28',
      method: 'Wire Transfer',
      status: 'paid',
    },
    {
      id: 'INV-2026-005',
      customer: 'David Kim',
      amount: '$49.00',
      date: '2026-10-29',
      method: 'Visa •••• 1024',
      status: 'failed',
    },
  ]);

  const columns = [
    {
      header: 'Invoice ID',
      accessor: 'id',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-indigo-300">
          {row.id}
        </span>
      ),
    },
    {
      header: 'Customer',
      accessor: 'customer',
      render: (row) => (
        <span className="font-medium text-white text-sm">{row.customer}</span>
      ),
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => (
        <span className="font-bold text-white text-sm">{row.amount}</span>
      ),
    },
    {
      header: 'Payment Method',
      accessor: 'method',
      render: (row) => (
        <span className="text-xs text-slate-400 flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-slate-400" />
          {row.method}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => (
        <span className="text-xs text-slate-400">{row.date}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const styles = {
          paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
              styles[row.status] || styles.paid
            }`}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      header: 'Action',
      accessor: 'action',
      render: () => (
        <button
          onClick={() => alert('Downloading invoice PDF...')}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Download receipt"
        >
          <Download className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Billing & Payment History"
        subtitle="Auditable log of subscription charges, payment receipts, and collection states"
        actions={
          <button
            onClick={() => alert('Exporting CSV summary')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
          >
            <Download className="h-4 w-4" />
            Export Statement
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          icon={Receipt}
          label="Total Collected (This Month)"
          value="$3,577.00"
          trend={15.2}
          trendLabel="vs last month"
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          icon={Clock}
          label="Pending Clearance"
          value="$190.00"
          trend={null}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
        />
        <StatCard
          icon={AlertCircle}
          label="Failed Invoices"
          value="$49.00"
          trend={-1.5}
          trendLabel="dunning in progress"
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
        />
      </div>

      <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/80 p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-white mb-4">Transaction History</h3>
        <DataTable
          columns={columns}
          data={invoices}
          emptyTitle="No invoices recorded"
          emptyDescription="Recorded billing invoices will show up here."
        />
      </div>
    </div>
  );
};
