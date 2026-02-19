// ──────────────────────────────────────────
// HowItWorks — 3-step visual flow
// ──────────────────────────────────────────
import { memo } from 'react';
import { MessageCircleQuestion, Search, Sparkles } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const steps = [
  {
    num: '01',
    icon: MessageCircleQuestion,
    title: 'Ask a Question',
    desc: 'Type your academic query — admissions, courses, fees, regulations. Our AI enhances your question for optimal retrieval.',
  },
  {
    num: '02',
    icon: Search,
    title: 'AI Retrieves & Grades',
    desc: 'The RAG pipeline searches curated university documents, grades each chunk for relevance, and self-corrects if results are weak.',
  },
  {
    num: '03',
    icon: Sparkles,
    title: 'Get Accurate Answer',
    desc: 'Top-ranked passages are synthesized into a clear, cited response — grounded in official university documentation.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/20 via-transparent to-navy-900/20" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section header */}
        <ScrollReveal className="text-center mb-20">
          <span className="text-2xs font-medium text-mustard-600 tracking-[0.25em] uppercase block mb-3">
            Process
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-base text-ash max-w-xl mx-auto leading-relaxed">
            Three simple steps from question to answer — powered by cutting-edge AI.
          </p>
        </ScrollReveal>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, i) => (
            <ScrollReveal key={step.num} index={i}>
              <div className="relative group">
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(100%+0.5rem)] w-[calc(100%-1rem)] h-px">
                    <div className="w-full h-full bg-gradient-to-r from-mustard-500/30 via-mustard-500/15 to-transparent" />
                  </div>
                )}

                <div
                  className="relative p-7 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.015]
                             backdrop-blur-sm hover:border-mustard-500/20 hover:bg-white/[0.03]
                             transition-all duration-600 h-full"
                >
                  {/* Step number */}
                  <div className="flex items-center gap-4 mb-5">
                    <span className="text-3xl font-display font-bold text-mustard-500/30">{step.num}</span>
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center
                                 bg-gradient-to-br from-mustard-500/15 to-mustard-500/5
                                 border border-white/[0.06]
                                 group-hover:scale-105 transition-transform duration-500"
                    >
                      <step.icon className="w-5 h-5 text-mustard-500" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-lg font-semibold uppercase text-cream tracking-wide mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-ash leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(HowItWorks);
