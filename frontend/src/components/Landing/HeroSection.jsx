// ──────────────────────────────────────────
// HeroSection — main hero with stats
// ──────────────────────────────────────────
import { memo } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useChatStore from '@/store/useChatStore';

const stats = [
  { metric: '50+', label: 'Academic Programs', desc: 'BS, ADP, MS & PhD' },
  { metric: '3', label: 'Knowledge Bases', desc: 'Curated Document Collections' },
  { metric: 'AI', label: 'Powered Answers', desc: 'GPT-4o + RAG Pipeline' },
  { metric: '6×', label: 'Self-Correcting', desc: 'Smart Retrieval Retries' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] },
});

function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-dvh flex flex-col items-center justify-center px-6 pt-20 pb-12 overflow-hidden">
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

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto">
        {/* Logo */}
        <motion.div {...fadeUp(0)} className="mb-6">
          <img
            src="/unnamed.jpg"
            alt="University of Education"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_40px_rgba(200,185,74,0.15)]"
          />
        </motion.div>

        {/* Status badge */}
        <motion.div {...fadeUp(0.1)} className="mb-8">
          <span
            className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full
                       border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm
                       text-xs font-medium text-ash tracking-[0.15em] uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-mustard-500 animate-pulse" />
            AI-Powered Academic Assistant
          </span>
        </motion.div>

        {/* Hero headline */}
        <motion.h1
          {...fadeUp(0.15)}
          className="font-display text-hero font-bold uppercase text-cream leading-[0.92] tracking-tight mb-6"
        >
          UNIVERSITY
          <br />
          <span className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent">
            OF EDUCATION
          </span>
        </motion.h1>

        {/* Thin divider */}
        <motion.div
          {...fadeUp(0.2)}
          className="w-32 h-px bg-gradient-to-r from-transparent via-mustard-500/50 to-transparent mb-6"
        />

        {/* Subtitle */}
        <motion.p
          {...fadeUp(0.25)}
          className="text-base sm:text-lg text-ash font-light max-w-2xl leading-relaxed tracking-wide mb-10"
        >
          Your intelligent companion for navigating academic programs,
          admissions, and university regulations — powered by self-correcting
          AI retrieval that adapts until it finds the right answer.
        </motion.p>

        {/* Dual CTAs */}
        <motion.div {...fadeUp(0.3)} className="flex flex-wrap items-center justify-center gap-4 mb-16">
          {/* Primary */}
          <button
            onClick={() => navigate('/chat')}
            className="group relative inline-flex items-center gap-3 px-9 py-4 rounded-full
                       bg-mustard-500 text-navy-950 font-semibold text-sm uppercase tracking-[0.18em]
                       hover:bg-mustard-400 hover:shadow-glow
                       transition-all duration-500 ease-out active:scale-[0.97]"
          >
            <span>Start Exploring</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl bg-mustard-400/25 -z-10" />
          </button>

          {/* Secondary — ghost scroll */}
          <button
            onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}
            className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full
                       border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm
                       text-sm font-medium text-ash hover:text-cream hover:border-mustard-500/25
                       transition-all duration-500"
          >
            <span>Learn More</span>
            <ChevronDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
          </button>
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 + i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="group relative p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]
                         backdrop-blur-sm hover:border-mustard-500/20 hover:bg-white/[0.04]
                         transition-all duration-500"
            >
              <div className="text-2xl sm:text-3xl font-display font-bold text-mustard-500 mb-1">
                {s.metric}
              </div>
              <div className="text-sm font-semibold text-cream mb-0.5">{s.label}</div>
              <div className="text-xs text-mist">{s.desc}</div>
              {/* hover glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-mustard-500/[0.03] -z-10 blur-xl" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
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
