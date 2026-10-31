import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ message = 'Loading...', size = 'md' }) => {
  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className={`${sizes[size]} text-violet-500 animate-spin mb-3`} />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
};
