// ──────────────────────────────────────────
// FeaturesGrid — 4 Ivory Archive catalog cards
// Capabilities details with clean hierarchy & reveal checklists
// Inspired by Stitch "Digital Archivist" design system
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Layers, Database, RefreshCw } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const features = [
  {
    icon: Brain,
    num: '01',
    title: 'Agentic RAG',
    desc: 'Self-correcting retrieval that grades, rewrites, and retries up to 6 times — adapting its strategy until it finds the right answer.',
    checklist: ['Self-correcting pipeline', '6 automatic retries', 'Adaptive strategy'],
  },
  {
    icon: Layers,
    num: '02',
    title: 'Multi-Namespace',
    desc: 'Three curated knowledge bases covering BS/ADP programs, MS/PhD research, and university rules & regulations.',
    checklist: ['BS/ADP Programs', 'MS/PhD Research', 'Rules & Regulations'],
  },
  {
    icon: Database,
    num: '03',
    title: 'Conversation Memory',
    desc: 'Redis-powered session memory retains context across your conversation — no need to repeat yourself.',
    checklist: ['Redis powered', 'Session persistence', 'Context aware'],
  },
  {
    icon: RefreshCw,
    num: '04',
    title: 'Accurate Answers',
    desc: 'Every retrieved chunk is graded for relevance so only grounded and useful information reaches you.',
    checklist: ['Relevance grading', 'Grounded responses', 'Precision focused'],
  },
];

/* ── Single feature card ── */
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
          <div className="p-8 sm:p-9 flex flex-col h-full">
            {/* Top row: step number + icon */}
            <div className="flex items-start justify-between mb-6">
              {/* Step number — prominent editorial, mustard gold */}
              <span
                className="block text-2xl font-display font-bold tracking-tight leading-none"
                style={{ color: 'rgba(200,185,74,0.35)' }}
              >
                {feature.num}
              </span>

              {/* Icon — muted tinted square */}
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
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

            {/* Title */}
            <h3
              className="font-display text-[1.125rem] font-semibold tracking-tight mb-3"
              style={{ color: '#E8E4DC' }}
            >
              {feature.title}
            </h3>

            {/* Description or Checklist container */}
            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                {!isHovered ? (
                  <motion.p
                    key="desc"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm leading-[1.7]"
                    style={{ color: '#8A95A8' }}
                  >
                    {feature.desc}
                  </motion.p>
                ) : (
                  <motion.div
                    key="checklist"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full"
                  >
                    <p
                      className="text-[0.6875rem] font-medium tracking-[0.2em] uppercase mb-4"
                      style={{ color: 'rgba(200,185,74,0.4)' }}
                    >
                      Key Capabilities
                    </p>
                    <ul className="space-y-3">
                      {feature.checklist.map((item) => (
                        <li
                          key={item}
                          className="text-xs leading-relaxed pl-4 flex items-center gap-2"
                          style={{
                            color: 'rgba(138,149,168,0.7)',
                            borderLeft: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: '#C8B94A' }}
                          />
                          <span style={{ color: '#8A95A8' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom accent line */}
          <div
            className="h-px w-full mt-auto transition-opacity duration-300"
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
    <section id="features" className="relative py-28 sm:py-36">
      {/* Background — clean solid */}
      <div className="absolute inset-0" style={{ background: '#0B1120' }} />

      {/* Subtle tonal shift to separate from adjacent sections */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(21,27,43,0.3) 0%, transparent 20%, transparent 80%, rgba(21,27,43,0.3) 100%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header */}
        <ScrollReveal className="text-center mb-16">
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
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: '#8A95A8' }}
          >
            Every component of our pipeline is engineered for accuracy, speed, and reliability — from retrieval to generation.
          </p>
        </ScrollReveal>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(FeaturesGrid);
