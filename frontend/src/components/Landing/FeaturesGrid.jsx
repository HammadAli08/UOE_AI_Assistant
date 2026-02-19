// ──────────────────────────────────────────
// FeaturesGrid — 4 feature cards
// ──────────────────────────────────────────
import { memo } from 'react';
import { Brain, Layers, Database, RefreshCw } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const features = [
  {
    icon: Brain,
    title: 'Smart RAG',
    desc: 'Self-correcting retrieval that grades, rewrites, and retries up to 6 times — adapting its strategy until it finds the right answer.',
    accent: 'from-mustard-500/20 to-mustard-500/5',
  },
  {
    icon: Layers,
    title: 'Multi-Namespace',
    desc: 'Three curated knowledge bases covering BS/ADP programs, MS/PhD research, and university rules & regulations.',
    accent: 'from-olive-400/20 to-olive-400/5',
  },
  {
    icon: Database,
    title: 'Conversation Memory',
    desc: 'Redis-powered session memory retains context across your conversation — no need to repeat yourself.',
    accent: 'from-blue-500/20 to-blue-500/5',
  },
  {
    icon: RefreshCw,
    title: 'Accurate Answers',
    desc: 'Every retrieved chunk is graded for relevance and reranked for precision — only the best information reaches you.',
    accent: 'from-purple-500/20 to-purple-500/5',
  },
];

function FeaturesGrid() {
  return (
    <section id="features" className="relative py-28 sm:py-36">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px]
                   rounded-full blur-[160px] opacity-60"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header */}
        <ScrollReveal className="text-center mb-16">
          <span className="text-2xs font-medium text-mustard-600 tracking-[0.25em] uppercase block mb-3">
            Capabilities
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-4">
            Intelligent by Design
          </h2>
          <p className="text-base text-ash max-w-2xl mx-auto leading-relaxed">
            Every component of our pipeline is engineered for accuracy,
            speed, and reliability — from retrieval to generation.
          </p>
        </ScrollReveal>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} index={i}>
              <div
                className="group relative h-full p-6 sm:p-7 rounded-2xl
                           border border-white/[0.06] bg-white/[0.015]
                           backdrop-blur-sm
                           hover:border-mustard-500/20 hover:bg-white/[0.03]
                           transition-all duration-600"
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5
                              bg-gradient-to-br ${f.accent} border border-white/[0.06]
                              group-hover:scale-105 transition-transform duration-500`}
                >
                  <f.icon className="w-5 h-5 text-cream" />
                </div>

                {/* Content */}
                <h3 className="font-display text-lg font-semibold uppercase text-cream tracking-wide mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-ash leading-relaxed">
                  {f.desc}
                </p>

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

export default memo(FeaturesGrid);
