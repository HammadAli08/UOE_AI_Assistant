// ──────────────────────────────────────────
// HeroSection — premium asymmetrical hero with floating chat preview
// ──────────────────────────────────────────
import { memo, useRef, useEffect, useState, useCallback } from 'react';
import { ArrowRight, ChevronDown, MessageCircle, Sparkles, Bot } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/* ── Stat data ── */
const stats = [
  { metric: 50, suffix: '+', label: 'Academic Programs', desc: 'BS, ADP, MS & PhD' },
  { metric: 4, suffix: '', label: 'Knowledge Bases', desc: 'Curated Document Collections' },
  { metric: 0, prefix: 'AI', suffix: '', label: 'Powered Answers', desc: 'GPT-4o + RAG Pipeline', isText: true },
  { metric: 5, suffix: '×', label: 'Self-Correcting', desc: 'Agentic Retrieval Retries' },
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

/* ── Stat Card with premium surface ── */
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
      initial={{ opacity: 0, y: 24 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        ease: [0.19, 1, 0.22, 1],
        delay: 0.4 + index * 0.1,
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.3, ease: [0.19, 1, 0.22, 1] },
      }}
      className="group relative p-5 rounded-2xl backdrop-blur-sm surface-1"
    >
      <div className="text-2xl sm:text-3xl font-display font-bold text-mustard-500 mb-1">
        {stat.isText ? stat.prefix : (stat.prefix || '')}{!stat.isText && count}{stat.suffix}
      </div>
      <div className="text-sm font-semibold text-cream mb-0.5">{stat.label}</div>
      <div className="text-xs text-mist">{stat.desc}</div>
    </motion.div>
  );
}

/* ── Floating Chat Preview — shows the product in action ── */
function FloatingChatPreview() {
  const navigate = useNavigate();
  const messages = [
    { type: 'user', text: 'What is Prerequisite of Compiler Construction?' },
    {
      type: 'ai',
      text: 'The course name is Compiler Construction (COMP3149). The prerequisite for this course is Theory of Automata.',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotateY: -5 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 1, ease: [0.19, 1, 0.22, 1], delay: 0.6 }}
      className="relative w-full max-w-md"
      style={{ perspective: '1200px' }}
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-4 rounded-3xl blur-[60px] opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.12) 0%, transparent 70%)' }}
      />

      {/* Chat window — clickable to navigate to chat */}
      <div
        onClick={() => navigate('/chat')}
        className="relative rounded-2xl overflow-hidden surface-2 backdrop-blur-xl cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-2xs text-mist font-medium tracking-wider uppercase">UOE AI Chat</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-mustard-500 animate-pulse" />
            <span className="text-2xs text-mustard-600">Live</span>
          </div>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.type === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.5, duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}`}
            >
              {msg.type === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-mustard-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-mustard-400" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-3 rounded-xl text-xs leading-relaxed ${
                  msg.type === 'user'
                    ? 'bg-mustard-500/15 text-cream border border-mustard-500/20 rounded-br-md'
                    : 'bg-white/[0.03] text-ash border border-white/[0.06] rounded-bl-md'
                }`}
              >
                {msg.text.split('\n').map((line, li) => (
                  <span key={li}>
                    {line}
                    {li < msg.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
              {msg.type === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="w-3.5 h-3.5 text-mist" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Input preview */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <span className="text-xs text-mist/50">Ask about admissions, programs...</span>
            <Sparkles className="w-3.5 h-3.5 text-mustard-500/40 ml-auto" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── easeOutExpo spring-up ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.7,
    ease: [0.19, 1, 0.22, 1],
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

  const rawY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, 80]);
  const heroY = useSpring(rawY, { stiffness: 50, damping: 20 });

  return (
    <section
      ref={sectionRef}
      className="hero hero-edge-photos relative min-h-dvh flex items-center px-6 pt-24 pb-16 overflow-visible bg-cover bg-center bg-no-repeat"
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute top-[15%] left-[30%] w-[800px] h-[600px] rounded-full blur-[160px] animate-glow-pulse"
          style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.07) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[600px] h-[500px] rounded-full blur-[120px] opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(140,147,64,0.1) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[30%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[130px] opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(100,120,200,0.06) 0%, transparent 70%)' }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-navy-950/60 z-[5]" />
      </div>

      {/* ── Content: Asymmetrical 60/40 split ── */}
      <motion.div
        style={{ y: heroY }}
        className="relative z-10 w-full max-w-7xl mx-auto"
      >
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left column — 60% — Text content */}
          <div className="flex-1 lg:max-w-[58%] text-center lg:text-left ml-9">
            {/* Header branding group */}
            <div className="flex flex-col items-center lg:items-center lg:w-fit gap-6 mb-8">
              {/* Logo */}
              <motion.div {...fadeUp(0)} className="flex">
                <motion.img
                  src="/unnamed.jpg"
                  alt="University of Education, Lahore — official logo"
                  fetchpriority="high"
                  loading="eager"
                  decoding="sync"
                  width="96"
                  height="96"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_40px_rgba(200,185,74,0.15)]"
                  whileHover={{ scale: 1.08, rotate: 2, transition: { duration: 0.3 } }}
                />
              </motion.div>

              {/* Status badge */}
              <motion.div {...fadeUp(0.08)} className="flex">
                <span
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full
                             border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm
                             text-sm font-medium text-ash tracking-[0.12em] uppercase"
                >
                  <span className="w-2 h-2 rounded-full bg-mustard-500 animate-pulse" />
                  AI-Based Academics and Regulations Assistant
                </span>
              </motion.div>
            </div>

            {/* ── Headline ── */}
            <motion.h1
              {...fadeUp(0.14)}
              className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-cream leading-[0.95] tracking-tight mb-6"
            >
              University{' '}
              <span className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent">
                of Education
              </span>
              <br />
              <span className="text-ash/60 text-[0.55em] font-medium tracking-wider">
                AI-Powered Guidance
              </span>
            </motion.h1>

            {/* Thin divider */}
            <motion.div
              {...fadeUp(0.18)}
              className="w-24 h-px bg-gradient-to-r from-mustard-500/50 to-transparent mb-6 mx-auto lg:mx-0"
            />

            {/* Subtitle */}
            <motion.p
              {...fadeUp(0.22)}
              className="text-base sm:text-lg text-ash font-light max-w-xl leading-relaxed tracking-wide mb-10 mx-auto lg:mx-0"
            >
              Your intelligent companion for navigating academic programs,
              admissions, and university regulations — powered by self-correcting
              AI retrieval that adapts until it finds the right answer.
            </motion.p>

            {/* ── Dual CTAs ── */}
            <motion.div {...fadeUp(0.26)} className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-12 lg:mb-0">
              <button
                onClick={() => navigate('/chat')}
                className="btn-primary group"
              >
                <span>Start Exploring</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>

              <button
                onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}
                aria-label="Scroll down to learn more about features"
                className="btn-ghost group"
              >
                <span>Learn More</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              </button>
            </motion.div>
          </div>

          {/* Right column — 40% — Floating Chat Preview */}
          <div className="flex-1 lg:max-w-[42%] flex justify-center">
            <FloatingChatPreview />
          </div>
        </div>

        {/* ── Stat cards — full width below ── */}
        <motion.div
          {...fadeUp(0.35)}
          className="mt-14 lg:mt-20"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl mx-auto">
            {stats.map((s, i) => (
              <StatCard key={s.label} stat={s} index={i} />
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
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
