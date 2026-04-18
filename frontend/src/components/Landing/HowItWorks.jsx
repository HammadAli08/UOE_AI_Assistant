// ──────────────────────────────────────────
// HowItWorks — "Ivory Archive" 3-step editorial process
// Clean numbered steps with thin connectors
// Inspired by Stitch "Digital Archivist" design system
// ──────────────────────────────────────────
import { memo, useState, Fragment } from 'react';
import { motion } from 'framer-motion';
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

/* ── Horizontal connector — thin solid line ── */
function HorizontalConnector() {
  return (
    <div className="hidden md:flex items-center justify-center px-3">
      <div className="relative w-full flex items-center">
        <div
          className="h-px w-full"
          style={{ background: 'rgba(200,185,74,0.15)' }}
        />
        <div
          className="absolute right-0 w-1.5 h-1.5 rounded-full"
          style={{ background: 'rgba(200,185,74,0.3)' }}
        />
      </div>
    </div>
  );
}

/* ── Step card — editorial style ── */
function StepCard({ step, index }) {
  const Icon = step.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -3 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative group h-full"
      >
        <div
          className="relative h-full rounded-xl overflow-hidden transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <div className="p-8 sm:p-9">
            {/* Step number — prominent editorial, mustard gold */}
            <span
              className="block text-2xl font-display font-bold tracking-tight mb-6"
              style={{ color: 'rgba(200,185,74,0.35)' }}
            >
              {step.num}
            </span>

            {/* Icon — muted tinted square */}
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center mb-6"
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

            {/* Title */}
            <h3
              className="font-display text-[1.125rem] font-semibold tracking-tight mb-3"
              style={{ color: '#E8E4DC' }}
            >
              {step.title}
            </h3>

            {/* Description */}
            <p
              className="text-sm leading-[1.7]"
              style={{ color: '#8A95A8' }}
            >
              {step.desc}
            </p>
          </div>

          {/* Bottom accent line */}
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

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background — clean solid, no patterns */}
      <div className="absolute inset-0" style={{ background: '#0B1120' }} />

      {/* Subtle tonal gradient for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(21,27,43,0.4) 0%, transparent 30%, transparent 70%, rgba(21,27,43,0.4) 100%)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section header — editorial plain label */}
        <ScrollReveal className="text-center mb-20">
          <span
            className="text-[0.6875rem] font-medium tracking-[0.25em] uppercase block mb-4"
            style={{ color: 'rgba(200,185,74,0.5)' }}
          >
            Process
          </span>
          <h2
            className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5"
            style={{ color: '#E8E4DC' }}
          >
            How It Works
          </h2>
          <p
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: '#8A95A8' }}
          >
            Three simple steps from question to answer — powered by cutting-edge AI.
          </p>
        </ScrollReveal>

        {/* Steps — 3 cards with connectors */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 md:gap-0 items-stretch">
          {steps.map((step, i) => (
            <Fragment key={step.num}>
              <StepCard step={step} index={i} />
              {i < steps.length - 1 && <HorizontalConnector />}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(HowItWorks);
