// ──────────────────────────────────────────
// TopBar — mobile header with animated menu trigger
// ──────────────────────────────────────────
import { memo } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { NAMESPACES } from '@/constants';

function TopBar() {
  const toggleSidebar = useChatStore((s) => s.toggleSidebar);
  const sidebarOpen   = useChatStore((s) => s.sidebarOpen);
  const namespace     = useChatStore((s) => s.namespace);
  const apiOnline     = useChatStore((s) => s.apiOnline);

  const currentNs = NAMESPACES.find((n) => n.id === namespace);

  return (
    <header
      className={clsx(
        'flex items-center justify-between px-4 h-14',
        'bg-navy-900/95 backdrop-blur-xl',
        'border-b border-white/[0.06]',
        'safe-top lg:hidden z-40 relative',
      )}
    >
      {/* Left: Animated hamburger → X button */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        className={clsx(
          'relative w-10 h-10 -ml-1.5 rounded-xl flex items-center justify-center',
          'transition-all duration-300 active:scale-90',
          sidebarOpen
            ? 'bg-mustard-500/15 text-mustard-400'
            : 'text-mist hover:text-cream hover:bg-white/[0.06]',
        )}
      >
        {/* Ring glow when open */}
        {sidebarOpen && (
          <span className="absolute inset-0 rounded-xl ring-1 ring-mustard-500/40 animate-pulse" />
        )}

        {/* Animated 3-line ↔ X */}
        <span className="relative flex flex-col justify-center items-center w-5 h-4 gap-[5px]">
          {/* Top line */}
          <span
            className={clsx(
              'block h-[1.5px] bg-current rounded-full',
              'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-center',
              sidebarOpen ? 'w-5 rotate-45 translate-y-[6.5px]' : 'w-5',
            )}
          />
          {/* Middle line */}
          <span
            className={clsx(
              'block h-[1.5px] bg-current rounded-full',
              'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              sidebarOpen ? 'w-0 opacity-0' : 'w-3.5 opacity-100',
            )}
          />
          {/* Bottom line */}
          <span
            className={clsx(
              'block h-[1.5px] bg-current rounded-full',
              'transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] origin-center',
              sidebarOpen ? 'w-5 -rotate-45 -translate-y-[6.5px]' : 'w-5',
            )}
          />
        </span>
      </button>

      {/* Center: Brand + Namespace */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0">
          <img src="/unnamed.jpg" alt="UOE" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-display font-semibold uppercase tracking-[0.08em] text-cream leading-tight">
            UOE AI
          </span>
          {currentNs && (
            <span className="text-2xs text-mist">{currentNs.label}</span>
          )}
        </div>
      </div>

      {/* Right: API Status */}
      <div className="p-2 -mr-1">
        {apiOnline === true ? (
          <Wifi className="w-4 h-4 text-emerald-400" />
        ) : apiOnline === false ? (
          <WifiOff className="w-4 h-4 text-red-400" />
        ) : (
          <Wifi className="w-4 h-4 text-mustard-500/60 animate-pulse" />
        )}
      </div>
    </header>
  );
}

export default memo(TopBar);
