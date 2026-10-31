import { Layers, ShieldCheck, Zap } from 'lucide-react';

export const Navbar = ({ backendStatus }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              SubFlow
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0.0 MVP
              </span>
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === 'healthy'
                  ? 'bg-emerald-400 animate-pulse'
                  : backendStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300 font-medium">
              API: {backendStatus === 'healthy' ? 'Online' : backendStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="hidden md:inline">Hackathon Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
};
