// ──────────────────────────────────────────
// HeroSection — kinetic hero with silky animations
// ──────────────────────────────────────────
import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/* ── Stat data ── */
const stats = [
  { metric: 50, suffix: '+', label: 'Academic Programs', desc: 'BS, ADP, MS & PhD' },
  { metric: 3, suffix: '', label: 'Knowledge Bases', desc: 'Curated Document Collections' },
  { metric: 0, prefix: 'AI', suffix: '', label: 'Powered Answers', desc: 'GPT-4o + RAG Pipeline', isText: true },
  { metric: 6, suffix: '×', label: 'Self-Correcting', desc: 'Agentic Retrieval Retries' },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ── Animated counter with smooth easing ── */
function useAnimatedCounter(target, isVisible, duration = 1800) {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!isVisible || target === 0 || prefersReducedMotion()) {
      setCount(target);
      return;
    }

    const start = performance.now();
    // Smooth elastic-out easing
    const ease = (t) => {
      const p = 0.4;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    };

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(ease(progress) * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
  }, [isVisible, target, duration]);

  return count;
}

/* ── Stat Card with spring entrance ── */
function StatCard({ stat, index }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const count = useAnimatedCounter(stat.metric, isVisible);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 15,
        mass: 0.6,
        delay: 0.3 + index * 0.12,
      }}
      whileHover={{
        y: -6,
        scale: 1.03,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }}
      className="group relative p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                 backdrop-blur-sm"
    >
      <div className="text-2xl sm:text-3xl font-display font-bold text-mustard-500 mb-1">
        {stat.isText ? stat.prefix : (stat.prefix || '')}{!stat.isText && count}{stat.suffix}
      </div>
      <div className="text-sm font-semibold text-cream mb-0.5">{stat.label}</div>
      <div className="text-xs text-mist">{stat.desc}</div>
      {/* hover glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-mustard-500/[0.04] -z-10 blur-xl"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />
    </motion.div>
  );
}

/* ── Smooth typewriter with gradient crossfade ── */
function TypewriterLine({ text, delay = 700 }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplayed(text);
      setDone(true);
      setStarted(true);
      return;
    }

    const timeout = setTimeout(() => {
      setStarted(true);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setTimeout(() => setDone(true), 200); // brief pause before gradient solidifies
        }
      }, 45);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay, reduced]);

  return (
    <motion.span
      className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent inline-block"
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={started ? { opacity: 1, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {displayed || '\u00A0'}
      {started && !done && (
        <motion.span
          className="text-mustard-400 inline-block ml-0.5"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        >
          |
        </motion.span>
      )}
    </motion.span>
  );
}

/* ── Spring-based fade-up ── */
const springUp = (delay = 0) => ({
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  transition: {
    type: 'spring',
    stiffness: 80,
    damping: 18,
    mass: 0.8,
    delay,
  },
});

/* ── Main Hero ── */
function HeroSection() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const reduced = prefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  // Spring-smoothed parallax for buttery motion
  const rawY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, 100]);
  const heroY = useSpring(rawY, { stiffness: 50, damping: 20 });

  return (
    <section
      ref={sectionRef}
      className="relative min-h-dvh flex flex-col items-center justify-center px-6 pt-20 pb-12 overflow-hidden"
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800" />
        <div
          className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1000px] h-[700px]
                     rounded-full blur-[160px] animate-glow-pulse"
          style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.08) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[600px] h-[500px]
                     rounded-full blur-[120px] opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(140,147,64,0.12) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[30%] right-[-10%] w-[500px] h-[500px]
                     rounded-full blur-[130px] opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(100,120,200,0.06) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-navy-950/60" />
      </div>

      {/* ── Content with spring parallax ── */}
      <motion.div
        style={{ y: heroY }}
        className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto"
      >
        {/* Logo */}
        <motion.div {...springUp(0)} className="mb-6">
          <motion.img
            src="/unnamed.jpg"
            alt="University of Education, Lahore — official logo"
            fetchpriority="high"
            loading="eager"
            decoding="sync"
            width="96"
            height="96"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_40px_rgba(200,185,74,0.15)]"
            whileHover={{ scale: 1.08, rotate: 2, transition: { type: 'spring', stiffness: 300 } }}
          />
        </motion.div>

        {/* Status badge */}
        <motion.div {...springUp(0.1)} className="mb-4">
          <span
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full
                       border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm
                       text-sm font-semibold text-ash tracking-[0.15em] uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-mustard-500 animate-pulse" />
            AI-Powered Academic Assistant
          </span>
        </motion.div>

        {/* ── Kinetic Hero Headline ── */}
        <motion.h1
          {...springUp(0.15)}
          className="font-display text-hero font-bold uppercase text-cream leading-[0.92] tracking-tight mb-6"
        >
          <span className="relative inline-block">
            <svg
              viewBox="0 0 600 80"
              className="w-full h-auto"
              aria-hidden="true"
              role="img"
            >
              <defs>
                <clipPath id="hero-clip">
                  <text
                    x="300"
                    y="65"
                    textAnchor="middle"
                    fontSize="76"
                    fontFamily="Oswald, sans-serif"
                    fontWeight="700"
                  >
                    UNIVERSITY
                  </text>
                </clipPath>
              </defs>
              <rect
                clipPath="url(#hero-clip)"
                width="100%"
                height="100%"
                fill="#E8E4DC"
              />
            </svg>
            <span className="sr-only">UNIVERSITY</span>
          </span>
          <br />
          <TypewriterLine text="OF EDUCATION" delay={700} />
        </motion.h1>

        {/* Thin divider */}
        <motion.div
          {...springUp(0.2)}
          className="w-32 h-px bg-gradient-to-r from-transparent via-mustard-500/50 to-transparent mb-6"
        />

        {/* Subtitle */}
        <motion.p
          {...springUp(0.25)}
          className="text-base sm:text-lg text-ash font-light max-w-2xl leading-relaxed tracking-wide mb-10"
        >
          Your intelligent companion for navigating academic programs,
          admissions, and university regulations — powered by self-correcting
          AI retrieval that adapts until it finds the right answer.
        </motion.p>

        {/* ── Dual CTAs ── */}
        <motion.div {...springUp(0.3)} className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <motion.button
            onClick={() => navigate('/chat')}
            className="group relative inline-flex items-center gap-3 px-9 py-4 rounded-full
                       bg-mustard-500 text-navy-950 font-semibold text-sm uppercase tracking-[0.18em]
                       focus-visible:outline-2 focus-visible:outline-mustard-400"
            whileHover={{
              scale: 1.06,
              boxShadow: '0 8px 35px rgba(200,185,74,0.35)',
              transition: { type: 'spring', stiffness: 400, damping: 15 },
            }}
            whileTap={{ scale: 0.97 }}
          >
            <span>Start Exploring</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </motion.button>

          <motion.button
            onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Scroll down to learn more about features"
            className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full
                       border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm
                       text-sm font-medium text-ash"
            whileHover={{
              borderColor: 'rgba(200,185,74,0.2)',
              color: '#E8E4DC',
              transition: { duration: 0.5 },
            }}
          >
            <span>Learn More</span>
            <ChevronDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
          </motion.button>
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
          {stats.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      </motion.div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, type: 'spring', stiffness: 60 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <button
          onClick={() => document.querySelector('#tech-bar')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center gap-2 text-mist/60 hover:text-ash transition-colors duration-300"
        >
          <span className="text-2xs uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-float" />
        </button>
      </motion.div>
    </section>
  );
}

export default memo(HeroSection);
