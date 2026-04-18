// ──────────────────────────────────────────
// Navbar — floating pill navigation with scroll-aware morphing
// ──────────────────────────────────────────
import { useState, useEffect, memo } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Capabilities', href: '#features' },
    { label: 'Knowledge Bases', href: '#knowledge-bases' },
    { label: 'Explorer', href: '/knowledge-bases', isRoute: true },
    { label: 'Team', href: '#team' },
  ];

  const handleNav = (href, isRoute) => {
    setMobileOpen(false);
    if (isRoute) {
      navigate(href);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'top-3 left-4 right-4 sm:left-auto sm:right-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-3xl sm:w-[calc(100%-2rem)]'
          : ''
      )}
    >
      <div
        className={clsx(
          'transition-all duration-500 ease-out',
          scrolled
            ? 'rounded-2xl border border-white/[0.08] bg-navy-950/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
            : 'bg-transparent'
        )}
      >
        {/* Glow line — bottom edge accent */}
        <div
          className={clsx(
            'absolute bottom-0 left-[15%] right-[15%] h-px transition-opacity duration-500',
            scrolled ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(200,185,74,0.3), transparent)',
          }}
        />

        <div
          className={clsx(
            'flex items-center justify-between transition-all duration-500',
            scrolled ? 'px-5 h-14' : 'max-w-7xl mx-auto px-6 sm:px-8 h-16'
          )}
        >
          {/* Logo */}
          <button
            onClick={() => {
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 group"
          >
            <img
              src="/unnamed.jpg"
              alt="UOE"
              className={clsx(
                'rounded-lg object-cover transition-all duration-500',
                scrolled ? 'w-7 h-7' : 'w-9 h-9'
              )}
            />
            <span
              className={clsx(
                'font-display font-semibold uppercase tracking-[0.14em] text-cream hidden sm:block transition-all duration-500',
                scrolled ? 'text-xs' : 'text-sm'
              )}
            >
              UOE AI Assistant
            </span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNav(link.href, link.isRoute)}
                className="relative text-sm text-ash hover:text-cream transition-colors duration-300 tracking-wide py-1
                           after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px
                           after:bg-mustard-500/40 after:transition-all after:duration-300
                           hover:after:w-full"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA + Mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="btn-primary !py-2 !px-5 !text-xs !gap-2 !tracking-[0.14em]"
            >
              <span>Start Chat</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-ash hover:text-cream transition-colors p-1.5 rounded-lg
                         hover:bg-white/[0.06]"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav"
            role="navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.19, 1, 0.22, 1] }}
            className={clsx(
              'md:hidden backdrop-blur-2xl border-t border-white/[0.06] px-6 py-5 space-y-1 mt-1',
              scrolled
                ? 'bg-navy-950/90 rounded-xl border border-white/[0.08]'
                : 'bg-navy-950/95'
            )}
          >
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNav(link.href, link.isRoute)}
                className="block w-full text-left text-sm text-ash hover:text-cream py-2.5 px-3
                           rounded-lg hover:bg-white/[0.04] transition-all duration-200"
              >
                {link.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

export default memo(Navbar);
