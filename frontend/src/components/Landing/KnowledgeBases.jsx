// ──────────────────────────────────────────
// KnowledgeBases — expanded namespace showcase
// ──────────────────────────────────────────
import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useChatStore from '@/store/useChatStore';
import { NAMESPACES, SUGGESTIONS } from '@/constants';
import ScrollReveal from './ScrollReveal';

const nsDescriptions = {
  'bs-adp': 'Comprehensive information about Bachelor of Science and Associate Degree programs — admissions, fee structures, course outlines, and program durations.',
  'ms-phd': 'Everything about postgraduate research programs — MS/MPhil eligibility, PhD requirements, credit hours, and research guidelines.',
  'rules': 'Official university policies — attendance rules, grading systems, examination procedures, and discipline guidelines.',
};

function KnowledgeBases() {
  const navigate = useNavigate();
  const setNamespace = useChatStore((s) => s.setNamespace);

  const handleExplore = (nsId) => {
    setNamespace(nsId);
    navigate('/chat');
  };

  return (
    <section id="knowledge-bases" className="relative py-28 sm:py-36">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px]
                   rounded-full blur-[160px] opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(140,147,64,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header */}
        <ScrollReveal className="text-center mb-16">
          <span className="text-2xs font-medium text-mustard-600 tracking-[0.25em] uppercase block mb-3">
            Knowledge Bases
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-4">
            Choose Your Domain
          </h2>
          <p className="text-base text-ash max-w-xl mx-auto leading-relaxed">
            Select a knowledge base to get focused, accurate answers from curated university documents.
          </p>
        </ScrollReveal>

        {/* Namespace cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {NAMESPACES.map((ns, i) => (
            <ScrollReveal key={ns.id} index={i}>
              <div
                className="group relative h-full p-7 rounded-2xl
                           border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm
                           hover:border-mustard-500/20 hover:bg-white/[0.03]
                           transition-all duration-600 flex flex-col"
              >
                {/* Icon & title */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-3xl">{ns.icon}</span>
                  <h3 className="font-display text-lg font-semibold uppercase text-cream tracking-wide">
                    {ns.label}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-sm text-ash leading-relaxed mb-5">
                  {nsDescriptions[ns.id]}
                </p>

                {/* Sample questions */}
                <div className="flex-1 mb-6">
                  <p className="text-2xs text-mist uppercase tracking-[0.2em] mb-3">Popular Questions</p>
                  <ul className="space-y-2">
                    {(SUGGESTIONS[ns.id] || []).slice(0, 3).map((q) => (
                      <li key={q} className="text-xs text-ash/70 leading-relaxed pl-3 border-l border-white/[0.06]">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleExplore(ns.id)}
                  className="group/btn inline-flex items-center gap-2 text-sm font-medium text-mustard-500
                             hover:text-mustard-400 transition-colors duration-300"
                >
                  <span>Explore {ns.label.split(' ')[0]}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
                </button>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-mustard-500/[0.02] -z-10 blur-xl" />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(KnowledgeBases);
