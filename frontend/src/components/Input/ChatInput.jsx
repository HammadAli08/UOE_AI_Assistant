// ──────────────────────────────────────────
// ChatInput — glass panel input with SmartRAG toggle + namespace picker
// ──────────────────────────────────────────
import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { Send, Square, AlertCircle, ChevronUp, Zap, Clock } from 'lucide-react';
import clsx from 'clsx';
import useAutoResize from '@/hooks/useAutoResize';
import useChatStore from '@/store/useChatStore';
import { MAX_QUERY_LENGTH, MAX_TURNS, NAMESPACES } from '@/constants';

function ChatInput({ onSend, onStop, isStreaming }) {
  const [value, setValue] = useState('');
  const [showNsPicker, setShowNsPicker] = useState(false);
  const [smartHovered, setSmartHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef(null);
  const nsPickerRef = useRef(null);
  const resize = useAutoResize(textareaRef, 160);

  // Scroll chat to bottom on input focus (mobile keyboard)
  useEffect(() => {
    const input = textareaRef.current;
    if (!input) return;
    const scrollToBottom = () => {
      setTimeout(() => {
        const messages = document.getElementById('messages');
        if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
      }, 120);
    };
    input.addEventListener('focus', scrollToBottom);
    return () => input.removeEventListener('focus', scrollToBottom);
  }, []);

  const turnCount = useChatStore((s) => s.turnCount);
  const apiOnline = useChatStore((s) => s.apiOnline);
  const namespace = useChatStore((s) => s.namespace);
  const setNamespace = useChatStore((s) => s.setNamespace);
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);

  const atMaxTurns = turnCount >= MAX_TURNS;
  const charCount = value.length;
  const overLimit = charCount > MAX_QUERY_LENGTH;
  const canSend = value.trim().length > 0 && !overLimit && !isStreaming && !atMaxTurns && apiOnline !== false;
  const currentNs = NAMESPACES.find((n) => n.id === namespace);

  // Close namespace picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (nsPickerRef.current && !nsPickerRef.current.contains(e.target)) {
        setShowNsPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    onSend(value);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [canSend, value, onSend]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChange = useCallback(
    (e) => {
      setValue(e.target.value);
      resize();
    },
    [resize]
  );

  const toggleSmart = () => {
    updateSettings({ enableSmart: !settings.enableSmart });
  };

  return (
    <div className="w-full flex-shrink-0 md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto bg-navy-900/60 backdrop-blur-md border-t border-white/6 safe-bottom:pb-[env(safe-area-inset-bottom)] z-30">
      <div className="max-w-4xl mx-auto flex flex-col px-2 sm:px-6 pt-4 pb-3">
        {/* ── Alerts ── */}
        {atMaxTurns && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-mustard-500/[0.08] border border-mustard-500/20 text-mustard-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Maximum turns reached. Start a new chat to continue.
          </div>
        )}

        {apiOnline === false && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Backend is offline. Please check the server.
          </div>
        )}

        {/* ── Glass input panel ── */}
        <div
          className={clsx(
            'rounded-2xl border backdrop-blur-xl transition-all duration-400',
            'bg-white/[0.03]',
            isFocused && !overLimit && 'input-glow-active',
            overLimit
              ? 'border-red-500/40'
              : 'border-white/[0.07] focus-within:border-mustard-500/30'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={atMaxTurns ? 'Max turns reached — start a new chat' : 'Ask about your academic programs…'}
            disabled={atMaxTurns}
            rows={1}
            className="w-full bg-transparent text-sm text-cream font-body placeholder:text-mist/70 px-4 pt-4 pb-2 resize-none outline-none min-h-[48px] max-h-[160px] disabled:opacity-40 disabled:cursor-not-allowed"
          />

          {/* Bottom row inside panel: namespace · char count · SmartRAG pill · Send */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left: namespace selector + char counter */}
            <div className="flex items-center gap-2">
              {/* ── Namespace selector (inside panel) ── */}
              <div className="relative" ref={nsPickerRef}>
                <button
                  onClick={() => setShowNsPicker(!showNsPicker)}
                  className="flex items-center gap-1.5 px-3 py-[7px] rounded-full text-xs font-medium
                             border border-white/[0.08] bg-white/[0.03] text-mist
                             hover:text-cream hover:border-white/[0.14]
                             transition-all duration-300 select-none"
                >
                  <span className="text-sm leading-none">{currentNs?.icon}</span>
                  <span className="tracking-wide hidden sm:inline">{currentNs?.label || 'Select'}</span>
                  <ChevronUp
                    className={clsx(
                      'w-3 h-3 transition-transform duration-300',
                      showNsPicker ? 'rotate-0' : 'rotate-180'
                    )}
                  />
                </button>

                {/* Namespace dropdown (pops up) */}
                {showNsPicker && (
                  <div
                    className="absolute bottom-full left-0 mb-2 w-60 rounded-xl
                               bg-navy-700/95 backdrop-blur-xl border border-white/[0.08]
                               shadow-elevated overflow-hidden animate-slide-down z-50"
                  >
                    <div className="p-1.5">
                      <p className="px-3 py-2 text-2xs font-semibold uppercase tracking-[0.15em] text-mist">
                        Knowledge Base
                      </p>
                      {NAMESPACES.map((ns) => (
                        <button
                          key={ns.id}
                          onClick={() => {
                            setNamespace(ns.id);
                            setShowNsPicker(false);
                          }}
                          className={clsx(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
                            'transition-all duration-300',
                            namespace === ns.id
                              ? 'bg-mustard-500/[0.1] text-mustard-400'
                              : 'text-ash hover:text-cream hover:bg-white/[0.04]'
                          )}
                        >
                          <span className="text-base">{ns.icon}</span>
                          <span className="font-medium">{ns.label}</span>
                          {namespace === ns.id && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-mustard-500 shadow-[0_0_6px_rgba(200,185,74,0.5)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Char counter */}
              {charCount > 0 && (
                <span
                  className={clsx(
                    'text-2xs tabular-nums font-mono',
                    overLimit ? 'text-red-400 font-semibold' : 'text-mist/60'
                  )}
                >
                  {charCount}/{MAX_QUERY_LENGTH}
                </span>
              )}
            </div>

            {/* Right: Smart toggle + Send */}
            <div className="flex items-center gap-2.5">
              {/* ── SmartRAG pill toggle ── */}
              <div
                className="relative"
                onMouseEnter={() => setSmartHovered(true)}
                onMouseLeave={() => setSmartHovered(false)}
              >
                <button
                  onClick={toggleSmart}
                  className={clsx(
                    'group flex items-center gap-1.5 px-3.5 py-[7px] rounded-full text-xs font-medium',
                    'border transition-all duration-500 ease-out select-none',
                    settings.enableSmart
                      ? 'bg-mustard-500/[0.14] text-mustard-400 border-mustard-500/25 shadow-glow-sm'
                      : 'bg-white/[0.03] text-mist border-white/[0.08] hover:border-white/[0.14] hover:text-ash'
                  )}
                >
                  <Zap
                    className={clsx(
                      'w-3.5 h-3.5 transition-all duration-500',
                      settings.enableSmart ? 'text-mustard-400 animate-smart-on' : ''
                    )}
                  />
                  <span className="tracking-wide">Smart</span>
                  {/* Animated glow dot */}
                  <span
                    className={clsx(
                      'w-[6px] h-[6px] rounded-full transition-all duration-500',
                      settings.enableSmart
                        ? 'bg-mustard-400 shadow-[0_0_8px_rgba(200,185,74,0.7)]'
                        : 'bg-mist/30'
                    )}
                  />
                </button>

                {/* Tooltip */}
                {smartHovered && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3
                               px-3.5 py-2 rounded-xl bg-navy-600/95 backdrop-blur-md
                               border border-white/[0.08] shadow-elevated
                               text-2xs text-ash whitespace-nowrap z-50
                               animate-slide-down pointer-events-none"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-mustard-500 flex-shrink-0" />
                      <span>Self-correcting retrieval · Takes a little longer</span>
                    </div>
                    {/* Arrow */}
                    <div
                      className="absolute -bottom-[5px] left-1/2 -translate-x-1/2
                                 w-2.5 h-2.5 bg-navy-600/95 border-r border-b border-white/[0.08]
                                 rotate-45 rounded-br-sm"
                    />
                  </div>
                )}
              </div>

              {/* ── Send / Stop button ── */}
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="w-9 h-9 rounded-full bg-red-500/70 hover:bg-red-500
                             flex items-center justify-center text-white
                             transition-all duration-300 active:scale-95"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={clsx(
                    'group w-9 h-9 rounded-full flex items-center justify-center',
                    'transition-all duration-400 active:scale-95',
                    canSend
                      ? 'bg-mustard-500 hover:bg-mustard-400 text-navy-950 shadow-glow-sm hover:shadow-glow'
                      : 'bg-white/[0.05] text-mist/40 cursor-not-allowed'
                  )}
                  title="Send message"
                >
                  <Send className={clsx(
                    'w-4 h-4 transition-transform duration-300',
                    canSend && 'group-hover:-rotate-45'
                  )} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom status bar ── */}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="hidden sm:inline-flex items-center gap-1 text-2xs text-mist/60">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-2xs font-mono text-mist/50">
              Enter
            </kbd>
            <span className="ml-0.5">to send</span>
          </span>
          <span className="flex items-center gap-1.5 text-2xs text-mist/60">
            <span
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                apiOnline === true && 'bg-green-500/80',
                apiOnline === false && 'bg-red-500/80',
                apiOnline === null && 'bg-mustard-500/60 animate-pulse'
              )}
            />
            {apiOnline === true ? 'Online' : apiOnline === false ? 'Offline' : 'Connecting…'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(ChatInput);
