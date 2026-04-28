// ──────────────────────────────────────────
// FeaturesGrid — 4 cinematic capability cards
// with animated gradient borders & reveal checklists
// ──────────────────────────────────────────
import { memo, useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Brain, Layers, Database, RefreshCw, Check } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const features = [
  {
    icon: Brain,
    num: '01',
    title: 'Agentic RAG',
    desc: 'Self-correcting retrieval that grades, rewrites, and retries up to 6 times — adapting its strategy until it finds the right answer.',
    gradient: 'from-amber-400 via-yellow-500 to-mustard-500',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    glowColor: 'rgba(245,158,11,0.15)',
    checklist: ['Self-correcting pipeline', '6 automatic retries', 'Adaptive strategy'],
  },
  {
    icon: Layers,
    num: '02',
    title: 'Multi-Namespace',
    desc: 'Three curated knowledge bases covering BS/ADP programs, MS/PhD research, and university rules & regulations.',
    gradient: 'from-emerald-400 via-green-500 to-olive-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    glowColor: 'rgba(52,211,153,0.15)',
    checklist: ['BS/ADP Programs', 'MS/PhD Research', 'Rules & Regulations'],
  },
  {
    icon: Database,
    num: '03',
    title: 'Conversation Memory',
    desc: 'Redis-powered session memory retains context across your conversation — no need to repeat yourself.',
    gradient: 'from-sky-400 via-blue-500 to-indigo-500',
    iconBg: 'bg-sky-500/10',
    iconColor: 'text-sky-400',
    glowColor: 'rgba(56,189,248,0.15)',
    checklist: ['Redis powered', 'Session persistence', 'Context aware'],
  },
  {
    icon: RefreshCw,
    num: '04',
    title: 'Accurate Answers',
    desc: 'Every retrieved chunk is graded for relevance so only grounded and useful information reaches you.',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    glowColor: 'rgba(167,139,250,0.15)',
    checklist: ['Relevance grading', 'Grounded responses', 'Precision focused'],
  },
];

/* ── Animated ring that draws around icon ── */
function IconRing({ color, isHovered }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56" fill="none">
      <motion.circle
        cx="28" cy="28" r="26"
        stroke="currentColor"
        strokeWidth="1"
        className={color}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isHovered
          ? { pathLength: 1, opacity: 0.5 }
          : { pathLength: 0, opacity: 0 }
        }
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
    </svg>
  );
}

/* ── Single feature card ── */
function FeatureCard({ feature, index }) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  const [visible, setVisible] = useState(false);
  const Icon = feature.icon;

  useEffect(() => {
    if (isInView) {
      const t = setTimeout(() => setVisible(true), index * 120);
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
        className="group relative h-full"
      >
        {/* Animated gradient border */}
        <div className="absolute -inset-px rounded-2xl overflow-hidden">
          <motion.div
            className={`absolute inset-0 bg-gradient-to-br ${feature.gradient}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />
          {/* Static subtle border when not hovered */}
          <div className="absolute inset-0 border border-white/[0.06] rounded-2xl pointer-events-none" />
        </div>

        {/* Card inner */}
        <div className="relative h-full rounded-2xl bg-navy-950 p-6 sm:p-7 overflow-hidden">
          {/* Hover glow blob */}
          <motion.div
            className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
            style={{ background: feature.glowColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />

          {/* Top row: number + icon */}
          <div className="relative flex items-start justify-between mb-5">
            <span className="text-[2.5rem] font-display font-bold leading-none text-white/[0.04] select-none">
              {feature.num}
            </span>
            <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center ${feature.iconBg} border border-white/[0.06]`}>
              <IconRing color={feature.iconColor} isHovered={isHovered} />
              <motion.div
                animate={isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Icon className={`w-6 h-6 ${feature.iconColor} relative z-10`} />
              </motion.div>
            </div>
          </div>

          {/* Title */}
          <h3 className="relative font-display text-lg font-semibold uppercase text-cream tracking-wide mb-2">
            {feature.title}
          </h3>

          {/* Description — collapses on hover to make room for checklist */}
          <AnimatePresence mode="wait">
            {!isHovered ? (
              <motion.p
                key="desc"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="relative text-sm text-ash leading-relaxed"
              >
                {feature.desc}
              </motion.p>
            ) : (
              <motion.ul
                key="checklist"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="relative space-y-2.5 pt-1"
              >
                {feature.checklist.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.3 }}
                    className="flex items-center gap-2.5 text-sm text-cream/90"
                  >
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${feature.iconBg} border border-white/[0.06]`}>
                      <Check className={`w-3 h-3 ${feature.iconColor}`} />
                    </span>
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          {/* Bottom gradient accent line */}
          <motion.div
            className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${feature.gradient}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={visible
              ? { scaleX: 1, opacity: isHovered ? 0.8 : 0.2 }
              : { scaleX: 0, opacity: 0 }
            }
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

function FeaturesGrid() {
  return (
    <section id="features" className="relative py-28 sm:py-36 overflow-hidden">
      {/* Background — distinct from HowItWorks: dot grid + dual gradient orbs */}
      <div className="absolute inset-0 bg-navy-950" />

      {/* Dot pattern (unique to this section) */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Warm gradient orb — left */}
      <div
        className="absolute top-1/3 -left-40 w-[600px] h-[600px]
                   rounded-full blur-[180px] opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.08) 0%, transparent 70%)' }}
      />

      {/* Cool gradient orb — right */}
      <div
        className="absolute bottom-1/4 -right-40 w-[500px] h-[500px]
                   rounded-full blur-[160px] opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }}
      />

      {/* Top divider line */}
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header — badge style (different from HowItWorks' plain label) */}
        <ScrollReveal className="text-center mb-16 sm:mb-20">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                       bg-mustard-500/[0.08] border border-mustard-500/20
                       text-2xs font-medium text-mustard-400 tracking-[0.2em] uppercase mb-4"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-mustard-500 animate-pulse" />
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
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(FeaturesGrid);
