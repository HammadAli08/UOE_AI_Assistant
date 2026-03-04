// ──────────────────────────────────────────
// HowItWorks — 3-step horizontal timeline with vertical mobile
// Clean, minimal process flow — distinct from FeaturesGrid
// ──────────────────────────────────────────
import { memo, useEffect, useRef, useState, Fragment } from 'react';
import { motion, useInView } from 'framer-motion';
import { MessageCircleQuestion, Search, Sparkles, ArrowRight } from 'lucide-react';
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

/* ── Horizontal connector (desktop) ── */
function HorizontalConnector({ index }) {
  const connRef = useRef(null);
  const isInView = useInView(connRef, { once: true, amount: 0.5 });
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setDraw(true), 600 + index * 300);
      return () => clearTimeout(t);
    }
  }, [isInView, index]);

  return (
    <div ref={connRef} className="hidden md:flex items-center justify-center px-2">
      <div className="relative w-full flex items-center">
        {/* Dashed line that draws in */}
        <motion.div
          className="h-px w-full"
          style={{
            background: 'linear-gradient(90deg, rgba(200,185,74,0.3), rgba(200,185,74,0.08))',
          }}
          initial={{ scaleX: 0 }}
          animate={draw ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {/* Arrow at the end */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={draw ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        >
          <ArrowRight className="w-4 h-4 text-mustard-500/40 flex-shrink-0" />
        </motion.div>
      </div>
    </div>
  );
}

/* ── Step card ── */
function StepCard({ step, index, isLast }) {
  const Icon = step.icon;
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  const [numVisible, setNumVisible] = useState(false);

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setNumVisible(true), 300 + index * 200);
      return () => clearTimeout(t);
    }
  }, [isInView, index]);

  return (
    <ScrollReveal index={index}>
      <motion.div
        ref={cardRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -6 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative group"
      >
        <div
          className="relative p-7 sm:p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                     hover:border-mustard-500/15 hover:bg-white/[0.035]
                     transition-all duration-500 h-full"
        >
          {/* Step number — large watermark */}
          <motion.span
            className="absolute top-4 right-5 text-5xl font-display font-bold leading-none text-white/[0.03] select-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={numVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {step.num}
          </motion.span>

          {/* Icon */}
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-5
                       bg-gradient-to-br from-mustard-500/12 to-mustard-500/5
                       border border-white/[0.06] group-hover:border-mustard-500/20
                       transition-colors duration-500"
          >
            <Icon className="w-5 h-5 text-mustard-500" />
          </motion.div>

          {/* Content */}
          <h3 className="font-display text-lg font-semibold uppercase text-cream tracking-wide mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-ash leading-relaxed">
            {step.desc}
          </p>
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background — clean gradient (no dot pattern, distinct from FeaturesGrid) */}
      <div className="absolute inset-0 bg-navy-950" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy-900/30 via-transparent to-navy-900/30" />

      {/* Subtle line grid (distinct from FeaturesGrid's dot pattern) */}
      <div
        className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Single centered glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px]
                   rounded-full blur-[200px] opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8">
        {/* Section header — plain label (different from FeaturesGrid's badge) */}
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

        {/* Steps — 3 cards with arrow connectors */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-6 md:gap-0 items-stretch">
          {steps.map((step, i) => (
            <Fragment key={step.num}>
              <StepCard step={step} index={i} isLast={i === steps.length - 1} />
              {i < steps.length - 1 && <HorizontalConnector index={i} />}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(HowItWorks);
