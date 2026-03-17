// ──────────────────────────────────────────
// AgenticBadge — Agentic RAG pipeline state with decision trail
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ChevronDown, ChevronUp, RotateCw,
  AlertTriangle, CheckCircle, Info, Zap,
  Split, MessageSquareWarning, Shield, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { AGENTIC_RAG_STATES } from '@/constants';

/* ── Determine the primary badge state ─────────────────────────── */
function getState(agenticInfo) {
  if (!agenticInfo) return null;

  // Agentic intent-based states
  const intent = agenticInfo.intent;
  if (intent === 'DIRECT')    return AGENTIC_RAG_STATES.DIRECT;
  if (intent === 'CLARIFY')   return AGENTIC_RAG_STATES.CLARIFY;
  if (intent === 'DECOMPOSE') return AGENTIC_RAG_STATES.DECOMPOSE;

  // Retrieval-based states
  if (agenticInfo.used_fallback)   return AGENTIC_RAG_STATES.FALLBACK;
  if (agenticInfo.best_effort)     return AGENTIC_RAG_STATES.BEST_EFFORT;
  if (agenticInfo.query_rewrites && agenticInfo.query_rewrites.length > 0) return AGENTIC_RAG_STATES.RETRY;
  return AGENTIC_RAG_STATES.PASS;
}

/* ── Get hallucination badge ───────────────────────────────────── */
function getHallucinationState(agenticInfo) {
  if (!agenticInfo || agenticInfo.hallucination_score == null) return null;
  if (agenticInfo.hallucination_score >= 0.6) return AGENTIC_RAG_STATES.GROUNDED;
  return AGENTIC_RAG_STATES.UNGROUNDED;
}

/* ── Style maps ────────────────────────────────────────────────── */
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

const INTENT_ICONS = {
  DIRECT:    Zap,
  RETRIEVE:  Brain,
  DECOMPOSE: Split,
  CLARIFY:   MessageSquareWarning,
};

/* ── Step label formatter ──────────────────────────────────────── */
function formatStep(step) {
  const node = step.node;
  const time = step.elapsed_ms ? `${Math.round(step.elapsed_ms)}ms` : '';

  switch (node) {
    case 'classify_intent':
      return { label: `Intent → ${step.intent || '?'}`, time, icon: Sparkles };
    case 'retrieve':
      return { label: `Retrieve: ${step.docs_found ?? 0} docs`, time, icon: Brain };
    case 'rerank':
      if (step.skipped) return { label: 'Rerank skipped', time, icon: Info };
      return { label: `Rerank: ${step.input_count} → ${step.output_count}`, time, icon: Shield };
    case 'grade':
      return { label: `Grade: ${step.relevant ?? 0}✓ ${step.irrelevant ?? 0}✗`, time, icon: CheckCircle };
    case 'quality_gate':
      return { label: `Decision: ${step.decision}`, time, icon: Zap };
    case 'rewrite':
      return { label: 'Query rewritten', time, icon: RotateCw };
    case 'decompose':
      return { label: `Split into ${step.count ?? '?'} sub-queries`, time, icon: Split };
    case 'hallucination_check':
      return { label: `Grounding: ${Math.round((step.score ?? 1) * 100)}%`, time, icon: Shield };
    case 'direct_answer':
      return { label: 'Direct answer', time, icon: Zap };
    case 'request_clarification':
      return { label: 'Asking for details', time, icon: MessageSquareWarning };
    case 'ready_for_generation':
      return { label: `${step.relevant_chunks ?? 0} chunks → LLM`, time, icon: Sparkles };
    default:
      return { label: node, time, icon: Info };
  }
}

/* ── Component ─────────────────────────────────────────────────── */
function AgenticBadge({ agenticInfo }) {
  const [expanded, setExpanded] = useState(false);
  const state = getState(agenticInfo);
  const hallucinationState = getHallucinationState(agenticInfo);

  if (!state) return null;

  const Icon = STATE_ICONS[state.color];
  const IntentIcon = INTENT_ICONS[agenticInfo?.intent] || Brain;
  const steps = agenticInfo?.steps || [];

  return (
    <div className="inline-block">
      {/* ── Primary badge ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <motion.button
          onClick={() => setExpanded(!expanded)}
          whileTap={{ scale: 0.95 }}
          className={clsx(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-medium',
            'border transition-all duration-300',
            STATE_STYLES[state.color]
          )}
        >
          <IntentIcon className="w-3 h-3" />
          <Brain className="w-3 h-3" />
          {state.label}
          {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </motion.button>

        {/* ── Hallucination badge (small, beside primary) ── */}
        {hallucinationState && (
          <span className={clsx(
            'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-2xs font-medium border',
            STATE_STYLES[hallucinationState.color]
          )}>
            <Shield className="w-2.5 h-2.5" />
            {hallucinationState.label}
          </span>
        )}
      </div>

      {/* ── Expanded decision trail ───────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mt-2 p-3 rounded-xl bg-navy-700/80 border border-white/[0.06]
                       text-2xs space-y-2"
          >
            <p className="text-mist italic">{state.desc}</p>

            {/* ── Key metrics grid ──────────────────────────── */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-ash pt-1">
              <span>Intent:</span>
              <span className="font-semibold text-cream">{agenticInfo.intent ?? '—'}</span>

              <span>Retrievals:</span>
              <span className="font-semibold text-cream">{agenticInfo.total_retrievals ?? '—'}</span>

              <span>Chunks graded:</span>
              <span className="font-semibold text-cream">{agenticInfo.total_chunks_graded ?? '—'}</span>

              <span>Relevant chunks:</span>
              <span className="font-semibold text-cream">{agenticInfo.final_relevant_chunks ?? '—'}</span>

              {agenticInfo.hallucination_score != null && (
                <>
                  <span>Grounding score:</span>
                  <span className="font-semibold text-cream">
                    {Math.round(agenticInfo.hallucination_score * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* ── Decomposed sub-queries ────────────────────── */}
            {agenticInfo.decomposed_queries && agenticInfo.decomposed_queries.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="font-medium text-ash mb-1">Sub-queries:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-mist">
                  {agenticInfo.decomposed_queries.map((q, i) => (
                    <li key={i} className="break-words">{q}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* ── Query rewrites ────────────────────────────── */}
            {agenticInfo.query_rewrites && agenticInfo.query_rewrites.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="font-medium text-ash mb-1">Rewrites:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-mist">
                  {agenticInfo.query_rewrites.map((rw, i) => (
                    <li key={i} className="break-words">
                      {typeof rw === 'string' ? rw : rw.rewritten_query ?? JSON.stringify(rw)}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ── Decision trail (steps) ────────────────────── */}
            {steps.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <p className="font-medium text-ash mb-1">Decision trail:</p>
                <div className="space-y-0.5">
                  {steps.map((step, i) => {
                    const { label, time, icon: StepIcon } = formatStep(step);
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-mist">
                        <StepIcon className="w-2.5 h-2.5 flex-shrink-0 text-ash" />
                        <span className="flex-1 break-words">{label}</span>
                        {time && <span className="text-ash/50 flex-shrink-0">{time}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(AgenticBadge);
