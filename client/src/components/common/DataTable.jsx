import { EmptyState } from './EmptyState';
import { Table } from 'lucide-react';

export const DataTable = ({
  columns = [],
  data = [],
  emptyTitle = 'No records found',
  emptyDescription = 'Records will appear here once available.',
}) => {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Table}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60">
            {columns.map((col, i) => (
              <th
                key={i}
                className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
            >
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="py-3 px-4 text-slate-300">
                  {col.render ? col.render(row) : row[col.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
