// ──────────────────────────────────────────
// FeaturesGrid — "Ivory Archive" Editorial Cards
// Tonal layering, ghost borders, single-accent design
// Inspired by Stitch "Digital Archivist" design system
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Layers, Database, Target } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const features = [
  {
    icon: Brain,
    num: '01',
    title: 'Agentic RAG',
    desc: 'Self-correcting retrieval that grades, rewrites, and retries up to 6 times — adapting its strategy until it finds the right answer.',
    tags: ['Self-Correcting', 'Hybrid Search', 'Verified'],
  },
  {
    icon: Layers,
    num: '02',
    title: 'Multi-Namespace',
    desc: 'Four curated knowledge bases covering BS/ADP programs, MS/PhD research, and university rules & regulations.',
    tags: ['Isolated', 'Scalable', 'Organized'],
  },
  {
    icon: Database,
    num: '03',
    title: 'Conversation Memory',
    desc: 'Redis-powered session memory retains context across your conversation — no need to repeat yourself.',
    tags: ['Stateful', 'Low Latency', 'Contextual'],
  },
  {
    icon: Target,
    num: '04',
    title: 'Accurate Answers',
    desc: 'Every retrieved chunk is graded for relevance so only grounded and useful information reaches you.',
    tags: ['High Fidelity', 'Precision', 'Ranked'],
  },
];

/* ── Single feature card — editorial style ── */
function FeatureCard({ feature, index }) {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = feature.icon;

  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -3 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative h-full"
      >
        <div
          className="relative h-full rounded-xl overflow-hidden flex flex-col transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          {/* Card content with generous padding */}
          <div className="p-8 sm:p-9 flex flex-col h-full">
            {/* Top row: step number + icon */}
            <div className="flex items-start justify-between mb-8">
              {/* Step number — editorial thin weight in mustard */}
              <span
                className="text-xs font-medium tracking-[0.2em] uppercase"
                style={{ color: 'rgba(200,185,74,0.5)' }}
              >
                {feature.num}
              </span>

              {/* Icon — muted tinted square, no glow */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(200,185,74,0.07)',
                  border: '1px solid rgba(200,185,74,0.1)',
                }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: '#C8B94A' }}
                  strokeWidth={1.5}
                />
              </div>
            </div>

            {/* Title — clean, no uppercase shouting */}
            <h3
              className="font-display text-[1.125rem] font-semibold tracking-tight mb-3"
              style={{ color: '#E8E4DC' }}
            >
              {feature.title}
            </h3>

            {/* Description */}
            <p
              className="text-sm leading-[1.7] mb-8 flex-1"
              style={{ color: '#8A95A8' }}
            >
              {feature.desc}
            </p>

            {/* Tags — small horizontal pills */}
            <div className="flex flex-wrap gap-2">
              {feature.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[0.6875rem] font-medium px-2.5 py-1 rounded"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    color: 'rgba(200,185,74,0.7)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom accent — thin solid line, not gradient */}
          <div
            className="h-px w-full transition-opacity duration-300"
            style={{
              background: '#C8B94A',
              opacity: isHovered ? 0.25 : 0.06,
            }}
          />
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

function FeaturesGrid() {
  return (
    <section id="features" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background — clean solid navy, no dot patterns */}
      <div className="absolute inset-0" style={{ background: '#0B1120' }} />

      {/* Subtle section separation via tonal shift at edges */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(15,22,35,0.3) 0%, transparent 15%, transparent 85%, rgba(15,22,35,0.3) 100%)',
        }}
      />

      {/* Top divider — ghost line */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header — editorial style */}
        <ScrollReveal className="text-center mb-16 sm:mb-20">
          <span
            className="text-[0.6875rem] font-medium tracking-[0.25em] uppercase block mb-4"
            style={{ color: 'rgba(200,185,74,0.5)' }}
          >
            Capabilities
          </span>
          <h2
            className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5"
            style={{ color: '#E8E4DC' }}
          >
            Intelligent by Design
          </h2>
          <p
            className="text-base max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#8A95A8' }}
          >
            Every component of our pipeline is engineered for accuracy,
            speed, and reliability — from retrieval to generation.
          </p>
        </ScrollReveal>

        {/* Cards grid — 2x2 on desktop for editorial feel */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(FeaturesGrid);
