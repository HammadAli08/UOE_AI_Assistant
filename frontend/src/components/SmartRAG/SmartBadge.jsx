// ──────────────────────────────────────────
// SmartBadge — dark cinematic Smart RAG pipeline state with animations
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, RotateCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import clsx from 'clsx';
import { SMART_RAG_STATES } from '@/constants';

function getState(smartInfo) {
  if (!smartInfo) return null;

  // Don't show badges for best_effort or fallback - user should not know RAG struggled
  // Just show pass or retry
  if (smartInfo.query_rewrites && smartInfo.query_rewrites.length > 0) return SMART_RAG_STATES.RETRY;
  return SMART_RAG_STATES.PASS;
}

const STATE_STYLES = {
  green: 'bg-green-500/10 text-green-400 border-green-500/20',
  amber: 'bg-mustard-500/10 text-mustard-400 border-mustard-500/20',
  blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  red:   'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATE_ICONS = {
  green: CheckCircle,
  amber: RotateCw,
  blue:  Info,
  red:   AlertTriangle,
};

function SmartBadge({ smartInfo }) {
  const [expanded, setExpanded] = useState(false);
  const state = getState(smartInfo);

  if (!state) return null;

  const Icon = STATE_ICONS[state.color];

  return (
    <div className="inline-block">
      <motion.button
        onClick={() => setExpanded(!expanded)}
        whileTap={{ scale: 0.95 }}
        className={clsx(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium',
          'border transition-all duration-300',
          STATE_STYLES[state.color]
        )}
      >
        <Icon className="w-3 h-3" />
        <Brain className="w-3 h-3" />
        {state.label}
        {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mt-2 p-3 rounded-xl bg-navy-700/80 border border-white/[0.06]
                       text-2xs space-y-1.5"
          >
            <p className="text-mist italic">{state.desc}</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ash pt-1">
              <span>Retrievals:</span>
              <span className="font-semibold text-cream">{smartInfo.total_retrievals ?? '—'}</span>

              <span>Chunks graded:</span>
              <span className="font-semibold text-cream">{smartInfo.total_chunks_graded ?? '—'}</span>

              <span>Relevant chunks:</span>
              <span className="font-semibold text-cream">{smartInfo.final_relevant_chunks ?? '—'}</span>
            </div>

            {smartInfo.query_rewrites && smartInfo.query_rewrites.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="font-medium text-ash mb-1">Rewrites:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-mist">
                  {smartInfo.query_rewrites.map((rw, i) => (
                    <li key={i} className="break-words">{rw}</li>
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(SmartBadge);
