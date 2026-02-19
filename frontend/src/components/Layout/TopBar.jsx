// ──────────────────────────────────────────
// TopBar — mobile header with menu trigger, namespace badge, status
// ──────────────────────────────────────────
import { memo } from 'react';
import { Menu, Wifi, WifiOff, GraduationCap } from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { NAMESPACES } from '@/constants';

function TopBar() {
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const namespace = useChatStore((s) => s.namespace);
  const apiOnline = useChatStore((s) => s.apiOnline);

  const currentNs = NAMESPACES.find((n) => n.id === namespace);

  return (
    <header
      className={clsx(
        'flex items-center justify-between px-4 h-14',
        'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md',
        'border-b border-slate-200/80 dark:border-slate-800/80',
        'shadow-topbar safe-top',
        'lg:hidden'
      )}
    >
      {/* Left: Menu */}
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800
                   text-slate-600 dark:text-slate-300 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: Brand + Namespace */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700
                        flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800 dark:text-white leading-tight">
            UOE AI
          </span>
          {currentNs && (
            <span className="text-2xs text-slate-500 dark:text-slate-400">
              {currentNs.label}
            </span>
          )}
        </div>
      </div>

      {/* Right: API Status */}
      <div className="p-2 -mr-2">
        {apiOnline === true ? (
          <Wifi className="w-4 h-4 text-green-500" />
        ) : apiOnline === false ? (
          <WifiOff className="w-4 h-4 text-red-500" />
        ) : (
          <Wifi className="w-4 h-4 text-yellow-500 animate-pulse" />
        )}
      </div>
    </header>
  );
}

export default memo(TopBar);
