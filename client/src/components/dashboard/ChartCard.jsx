export const ChartCard = ({ title, subtitle, children, className = '' }) => {
  return (
    <div className={`rounded-2xl bg-[#0f1129]/80 border border-slate-800/60 p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
};
