// ──────────────────────────────────────────
// ChatInput — glass panel input with Agentic RAG toggle + namespace picker
// ──────────────────────────────────────────
import { memo, useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, AlertCircle, ChevronUp, Zap, Clock, Mic, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import useAutoResize from '@/hooks/useAutoResize';
import useChatStore from '@/store/useChatStore';
import { MAX_QUERY_LENGTH, MAX_TURNS, NAMESPACES, API_BASE } from '@/constants';

function ChatInput({ onSend, onStop, isStreaming }) {
  const [value, setValue] = useState('');
  const [showNsPicker, setShowNsPicker] = useState(false);
  const textareaRef = useRef(null);
  const nsPickerRef = useRef(null);
  const resize = useAutoResize(textareaRef, 200);

  const [vttState, setVttState] = useState('idle'); // 'idle' | 'listening' | 'transcribing'
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const maxDurationTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafIdRef = useRef(null);

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
  const draftInput = useChatStore((s) => s.draftInput);
  const setDraftInput = useChatStore((s) => s.setDraftInput);

  const atMaxTurns = turnCount >= MAX_TURNS;
  const charCount = value.length;
  const overLimit = charCount > MAX_QUERY_LENGTH;
  const canSend = value.trim().length > 0 && !overLimit && !isStreaming && !atMaxTurns && apiOnline !== false;
  const currentNs = NAMESPACES.find((n) => n.id === namespace);

  // Sync draft input from store (e.g., when retry is clicked)
  useEffect(() => {
    if (draftInput && draftInput !== value) {
      setValue(draftInput);
      setDraftInput('');
      if (textareaRef.current) {
        textareaRef.current.focus();
        resize();
      }
    }
  }, [draftInput, value, setDraftInput, resize]);

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

  const stopRecordingAndTranscribe = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setVttState('listening');

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // VAD setup
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 512;
      analyser.minDecibels = -50; // tuned
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.4;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastVoiceTime = Date.now();

      const checkSilence = () => {
        if (mediaRecorderRef.current?.state !== 'recording') return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 15;

        if (isSpeaking) {
          lastVoiceTime = Date.now();
        }

        if (Date.now() - lastVoiceTime > 1500) {
          // 1.5s silence detected -> Auto stop
          stopRecordingAndTranscribe();
        } else {
          rafIdRef.current = requestAnimationFrame(checkSilence);
        }
      };

      checkSilence();

      // Max 15s duration cap
      maxDurationTimerRef.current = setTimeout(() => {
        stopRecordingAndTranscribe();
      }, 15000);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        cancelAnimationFrame(rafIdRef.current);
        clearTimeout(maxDurationTimerRef.current);

        if (audioContextRef.current?.state !== 'closed') {
          audioContextRef.current?.close();
        }

        stream.getTracks().forEach(t => t.stop());

        if (audioChunksRef.current.length === 0) {
          setVttState('idle');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVttState('transcribing');

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json();
          if (data.text) {
             setValue(prev => (prev ? prev + ' ' + data.text : data.text));
             resize();
             if (textareaRef.current) textareaRef.current.focus();
          }
        } catch (error) {
          console.error("VTT Error:", error);
        } finally {
          setVttState('idle');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      // Fail silently and revert state to keep UI clean
      setVttState('idle');
    }
  }, [stopRecordingAndTranscribe, resize]);

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

  const currentPlaceholder = atMaxTurns
    ? 'Max turns reached — start a new chat'
    : namespace === 'bs-adp' ? 'Ask about BS & ADP courses, fee structure, or durations...'
      : namespace === 'ms-phd' ? 'Ask about MS & PhD research, admissions, or faculty...'
        : namespace === 'rules' ? 'Ask about university exams, regulations, and grading...'
          : 'Ask about your academic programs…';

  const toggleAgentic = () => {
    updateSettings({ enableAgentic: !settings.enableAgentic });
  };

  return (
    <div className="w-full flex-shrink-0 md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto bg-surface-1 border-t border-surface-border safe-bottom:pb-[env(safe-area-inset-bottom)] z-30">
      <div className="max-w-[900px] mx-auto flex flex-col px-3 sm:px-6 lg:px-8 pt-3 pb-3">
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

        {/* ── Input panel — solid surface, static focus ── */}
        <div
          className={clsx(
            'rounded-xl border transition-colors duration-300',
            'bg-surface-2 shadow-[0_2px_8px_rgba(0,0,0,0.25)]',
            overLimit
              ? 'border-red-500/40'
              : 'border-surface-border focus-within:border-surface-border-hover'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={vttState === 'listening' ? 'Listening...' : vttState === 'transcribing' ? 'Transcribing...' : currentPlaceholder}
            disabled={atMaxTurns || vttState !== 'idle'}
            rows={1}
            aria-label="Type your question here"
            aria-multiline="true"
            className={clsx(
              "w-full bg-transparent text-[0.9375rem] text-textWhite font-body placeholder:text-mist/60 px-4 pt-3.5 pb-2 resize-none outline-none min-h-[48px] max-h-[200px] overflow-y-auto disabled:opacity-40 disabled:cursor-not-allowed",
              (vttState === 'listening' || vttState === 'transcribing') && 'animate-pulse text-mustard-400 placeholder:text-mustard-400/60'
            )}
          />

          {/* Divider between textarea and toolbar */}
          <div className="mx-3 h-px bg-surface-border/60" />

          {/* Bottom row inside panel: namespace · char count · Agentic RAG pill · Send */}
          <div className="agentic-parent relative flex items-center justify-between px-3 pb-3 overflow-visible">
            {/* Left: namespace selector + char counter */}
            <div className="flex items-center gap-2">
              {/* ── Namespace selector (inside panel) ── */}
              <div className="relative" ref={nsPickerRef}>
                <button
                  onClick={() => setShowNsPicker(!showNsPicker)}
                  aria-label={`Select knowledge base. Current: ${currentNs?.label || 'None'}`}
                  aria-expanded={showNsPicker}
                  aria-haspopup="listbox"
                  className="flex items-center gap-1.5 px-3 py-[7px] rounded-full text-xs font-medium
                             border border-white/[0.08] bg-white/[0.03] text-mist
                             hover:text-cream hover:border-white/[0.14]
                             transition-all duration-300 select-none"
                >
                  {currentNs?.icon && (() => { const Icon = currentNs.icon; return <Icon className="w-3.5 h-3.5 text-mist" />; })()}
                  <span className="tracking-wide hidden sm:inline">{currentNs?.label || 'Select'}</span>
                  <ChevronUp
                    className={clsx(
                      'w-3 h-3 transition-transform duration-300',
                      showNsPicker ? 'rotate-0' : 'rotate-180'
                    )}
                  />
                </button>

                {/* Namespace dropdown with height + opacity + translate animation */}
                <AnimatePresence>
                  {showNsPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 10, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ backfaceVisibility: 'hidden' }}
                      className="absolute bottom-full left-0 mb-2 w-60 rounded-xl
                                 bg-navy-700/95 backdrop-blur-xl ring-1 ring-inset ring-white/[0.08]
                                 shadow-elevated overflow-hidden z-50 flex-shrink-0"
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
                            {(() => { const Icon = ns.icon; return <Icon className="w-4 h-4" />; })()}
                            <span className="font-medium">{ns.label}</span>
                            {namespace === ns.id && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-mustard-500 shadow-[0_0_6px_rgba(200,185,74,0.5)]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

            {/* Right: Agentic toggle + Send */}
            <div 
              className="flex items-center gap-2.5 flex-shrink-0"
              style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
            >
              {/* ── Agentic RAG pill toggle with enable animation ── */}
              <div className="agentic-badge relative z-20 flex-shrink-0">
                <motion.button
                  onClick={toggleAgentic}
                  aria-pressed={settings.enableAgentic}
                  aria-label={settings.enableAgentic ? 'Disable Agentic RAG (autonomous retrieval)' : 'Enable Agentic RAG (autonomous retrieval)'}
                  className={clsx(
                    'group flex items-center gap-1.5 px-3.5 py-[7px] rounded-full text-xs font-medium',
                    'ring-1 ring-inset transition-all duration-500 ease-out select-none',
                    settings.enableAgentic
                      ? 'bg-mustard-500/[0.14] text-mustard-400 ring-mustard-500/25 shadow-glow-sm'
                      : 'bg-white/[0.03] text-mist ring-white/[0.08] hover:ring-white/[0.14] hover:text-ash'
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  <Zap
                    className={clsx(
                      'w-3.5 h-3.5 transition-all duration-500',
                      settings.enableAgentic ? 'text-mustard-400 animate-agentic-on' : ''
                    )}
                  />
                  <span className="tracking-wide">Agentic</span>
                  {/* Animated glow dot */}
                  <motion.span
                    animate={settings.enableAgentic ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={clsx(
                      'w-[6px] h-[6px] rounded-full transition-all duration-500',
                      settings.enableAgentic
                        ? 'bg-mustard-400 shadow-[0_0_8px_rgba(200,185,74,0.7)]'
                        : 'bg-mist/30'
                    )}
                  />
                </motion.button>
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex items-center gap-1.5">
                {/* VTT Button */}
                {!isStreaming && (
                  <button
                    onClick={vttState === 'listening' ? stopRecordingAndTranscribe : startRecording}
                    disabled={vttState === 'transcribing' || atMaxTurns || apiOnline === false}
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300',
                      vttState === 'listening'
                        ? 'bg-mustard-500/20 text-mustard-400 ring-1 ring-mustard-500/50 shadow-glow-sm animate-pulse'
                        : vttState === 'transcribing'
                        ? 'bg-surface-3 text-mustard-500 cursor-wait'
                        : 'bg-surface-2 text-mist hover:text-white hover:bg-surface-3 disabled:opacity-40'
                    )}
                    title={vttState === 'listening' ? "Stop recording" : "Voice to text"}
                    aria-label="Voice to text"
                  >
                    {vttState === 'transcribing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mic className={clsx('w-4 h-4 transition-transform duration-200', vttState === 'listening' && 'scale-110')} />
                    )}
                  </button>
                )}

                {/* ── Send / Stop button with diagonal movement ── */}
                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="w-8 h-8 rounded-lg bg-red-500/80 hover:bg-red-500
                               flex items-center justify-center text-white
                               transition-colors duration-200 active:scale-95"
                    aria-label="Stop generating response"
                    title="Stop generating"
                  >
                    <Square className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      'transition-all duration-200 active:scale-95',
                      canSend
                        ? 'bg-gold hover:brightness-110 text-navy-950'
                        : 'bg-surface-3 text-mist/30 cursor-not-allowed'
                    )}
                    title="Send message"
                  >
                    <Send className={clsx('w-4 h-4 transition-transform duration-200', canSend && '-rotate-45')} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom status bar with pulsing online indicator ── */}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="hidden sm:inline-flex items-center gap-1 text-2xs text-mist/60">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-2xs font-mono text-mist/50">
              Enter
            </kbd>
            <span className="ml-0.5">to send</span>
          </span>
          <span className="flex items-center gap-1.5 text-2xs text-mist/60">
            <motion.span
              animate={apiOnline === true ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={clsx(
                'w-1.5 h-1.5 rounded-full',
                apiOnline === true && 'bg-green-500/80',
                apiOnline === false && 'bg-red-500/80',
                apiOnline === null && 'bg-mustard-500/60'
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
