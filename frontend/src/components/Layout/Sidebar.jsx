// ──────────────────────────────────────────
// Sidebar — namespace picker, pipeline toggles, actions
// ──────────────────────────────────────────
import { memo } from 'react';
import {
  GraduationCap,
  FlaskConical,
  BookOpen,
  Plus,
  Settings2,
  Sun,
  Moon,
  Monitor,
  ChevronLeft,
  Search,
  Brain,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { NAMESPACES, MAX_TURNS } from '@/constants';

const NS_ICONS = {
  'bs-adp': GraduationCap,
  'ms-phd': FlaskConical,
  'rules': BookOpen,
};

function Sidebar({ theme, cycleTheme }) {
  const namespace = useChatStore((s) => s.namespace);
  const setNamespace = useChatStore((s) => s.setNamespace);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const newChat = useChatStore((s) => s.newChat);
  const turnCount = useChatStore((s) => s.turnCount);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const closeSidebar = useChatStore((s) => s.closeSidebar);
  const apiOnline = useChatStore((s) => s.apiOnline);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-50',
          'w-72 lg:w-72 flex flex-col',
          'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800',
          'shadow-sidebar lg:shadow-none',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                UOE AI
              </h1>
              <p className="text-2xs text-slate-500 dark:text-slate-400">
                Academic Assistant
              </p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat */}
        <div className="px-3 pt-3">
          <button
            onClick={() => { newChat(); closeSidebar(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                       bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium
                       shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Namespace Picker */}
        <div className="px-3 pt-5">
          <p className="px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Knowledge Base
          </p>
          <div className="space-y-1">
            {NAMESPACES.map((ns) => {
              const Icon = NS_ICONS[ns.id] || BookOpen;
              const active = namespace === ns.id;
              return (
                <button
                  key={ns.id}
                  onClick={() => { setNamespace(ns.id); closeSidebar(); }}
                  className={clsx('sidebar-link w-full', active && 'active')}
                >
                  <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                  <span className="truncate">{ns.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pipeline Toggles */}
        <div className="px-3 pt-5">
          <p className="px-3 text-2xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            <Settings2 className="w-3 h-3 inline mr-1 -mt-0.5" />
            Pipeline Options
          </p>
          <div className="space-y-1 px-1">
            <ToggleRow
              icon={Search}
              label="Query Enhancement"
              checked={settings.enhanceQuery}
              onChange={(v) => updateSettings({ enhanceQuery: v })}
            />
            <ToggleRow
              icon={Brain}
              label="Smart RAG"
              checked={settings.enableSmart}
              onChange={(v) => updateSettings({ enableSmart: v })}
            />

            {/* Top K slider */}
            <div className="px-2 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Retrieve Top K
                </span>
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 min-w-[20px] text-right">
                  {settings.topKRetrieve}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={settings.topKRetrieve}
                onChange={(e) => updateSettings({ topKRetrieve: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none
                           cursor-pointer accent-brand-600"
              />
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          {/* Session info */}
          <div className="flex items-center justify-between px-3 text-2xs text-slate-400 dark:text-slate-500">
            <span>Turns: {turnCount}/{MAX_TURNS}</span>
            <span className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  apiOnline === true && 'bg-green-500',
                  apiOnline === false && 'bg-red-500',
                  apiOnline === null && 'bg-yellow-500'
                )}
              />
              {apiOnline === true ? 'Online' : apiOnline === false ? 'Offline' : 'Checking...'}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="sidebar-link w-full text-slate-500 dark:text-slate-400"
          >
            <ThemeIcon className="w-4 h-4" />
            <span className="capitalize">{theme} mode</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Toggle Row ──
function ToggleRow({ icon: Icon, label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between px-2 py-2 rounded-lg
                       hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
      <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-8 h-[18px] bg-slate-300 dark:bg-slate-600 rounded-full
                        peer-checked:bg-brand-600 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-[14px] h-[14px] bg-white rounded-full
                        shadow-sm transition-transform peer-checked:translate-x-[14px]" />
      </div>
    </label>
  );
}

export default memo(Sidebar);
