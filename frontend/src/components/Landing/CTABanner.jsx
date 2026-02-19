// ──────────────────────────────────────────
// CTABanner — full-width closing call-to-action
// ──────────────────────────────────────────
import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function CTABanner() {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-950" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px]
                   rounded-full blur-[180px] opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.06) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 sm:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold uppercase text-cream tracking-tight mb-5">
            Ready to Get{' '}
            <span className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent">
              Answers?
            </span>
          </h2>
          <p className="text-base text-ash max-w-lg mx-auto leading-relaxed mb-10">
            Ask anything about University of Education programs, admissions,
            and regulations — our AI finds the most accurate answer for you.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="group relative inline-flex items-center gap-3 px-10 py-4 rounded-full
                       bg-mustard-500 text-navy-950 font-semibold text-sm uppercase tracking-[0.18em]
                       hover:bg-mustard-400 hover:shadow-glow
                       transition-all duration-500 ease-out active:scale-[0.97]"
          >
            <span>Start a Conversation</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl bg-mustard-400/25 -z-10" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}

export default memo(CTABanner);
