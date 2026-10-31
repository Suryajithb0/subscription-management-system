import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCard = ({
  icon: Icon,
  label,
  value,
  trend = null,
  trendLabel = '',
  loading = false,
  iconColor = 'text-violet-400',
  iconBg = 'bg-violet-500/10',
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-rose-400" />;
    return <Minus className="h-3.5 w-3.5 text-slate-500" />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-400';
    if (trend === 'down') return 'text-rose-400';
    return 'text-slate-500';
  };

  return (
    <div className="rounded-2xl bg-[#0f1129]/80 border border-slate-800/60 p-5 hover:border-violet-500/30 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg} border border-slate-700/30 group-hover:scale-105 transition-transform`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            {trendLabel && <span>{trendLabel}</span>}
          </div>
        )}
      </div>
      <div className="space-y-1">
        {loading ? (
          <div className="h-7 w-24 bg-slate-800 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-white tracking-tight">{value ?? '—'}</p>
        )}
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
};
