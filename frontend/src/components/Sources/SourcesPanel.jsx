// ──────────────────────────────────────────
// SourcesPanel — dark cinematic collapsible sources
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { FileText, Hash, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

function SourcesPanel({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-white/[0.05] animate-slide-up">
      <div className="space-y-2">
        {sources.map((src, i) => (
          <SourceCard key={i} source={src} index={i} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source, index }) {
  const [expanded, setExpanded] = useState(false);
  const score = source.score ?? 0;
  const scorePercent = Math.round(score * 100);

  const barColor =
    score >= 0.8 ? 'bg-green-500' :
      score >= 0.6 ? 'bg-blue-500' :
        score >= 0.4 ? 'bg-mustard-500' :
          'bg-red-400';

  const borderClass =
    score >= 0.7 ? 'source-card-green' :
      score >= 0.4 ? 'source-card-yellow' :
        'source-card-red';

  const snippet = source.text || source.content || source.snippet || null;

  return (
    <div
      className={clsx(
        'rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 transition-all duration-300',
        borderClass,
        expanded && 'bg-white/[0.035]'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          onClick={() => snippet && setExpanded(!expanded)}
          className={clsx(
            'flex items-center gap-1.5 text-xs font-medium text-ash min-w-0',
            snippet && 'hover:text-cream transition-colors duration-200 cursor-pointer'
          )}
        >
          <FileText className="w-3 h-3 flex-shrink-0 text-mist" />
          <span className="truncate">{source.file || `Source ${index + 1}`}</span>
          {snippet && (
            expanded
              ? <ChevronUp className="w-3 h-3 flex-shrink-0 text-mist/60" />
              : <ChevronDown className="w-3 h-3 flex-shrink-0 text-mist/60" />
          )}
        </button>
        <span className={clsx(
          'text-2xs font-semibold px-2 py-0.5 rounded-full border',
          score >= 0.7
            ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : score >= 0.4
              ? 'bg-mustard-500/10 text-mustard-400 border-mustard-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
        )}>
          {scorePercent}%
        </span>
      </div>

      {/* Relevance bar */}
      <div className="relevance-bar mb-2">
        <div
          className={clsx('relevance-bar-fill', barColor)}
          style={{ width: `${scorePercent}%` }}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-2xs text-mist">
        {source.page && (
          <span className="flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" />
            Page {source.page}
          </span>
        )}
        {source.department && (
          <span className="flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5" />
            {source.department}
          </span>
        )}
        {source.course_code && (
          <span className="font-mono text-mustard-400">
            {source.course_code}
          </span>
        )}
      </div>

      {/* Expandable text preview */}
      {expanded && snippet && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.04]">
          <p className="text-2xs text-ash/70 leading-relaxed line-clamp-4 italic">
            "{snippet.slice(0, 300)}{snippet.length > 300 ? '…' : ''}"
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(SourcesPanel);
