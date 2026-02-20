// ──────────────────────────────────────────
// Navbar — sticky glass navigation bar
// ──────────────────────────────────────────
import { useState, useEffect, memo } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';

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
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Knowledge Bases', href: '#knowledge-bases' },
  ];

  const handleNav = (href) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? 'bg-navy-950/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-glass'
        : 'bg-transparent'
        }`}
    >
      {/* Glow line */}
      <div className={clsx('nav-glow-line', scrolled && 'visible')} />
      <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/unnamed.jpg"
            alt="UOE"
            className="w-9 h-9 rounded-lg object-cover"
          />
          <span className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-cream hidden sm:block">
            UOE AI Assistant
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              className="text-sm text-ash hover:text-cream transition-colors duration-300 tracking-wide"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/chat')}
            className="group inline-flex items-center gap-2 px-5 py-2 rounded-full
                       bg-mustard-500 text-navy-950 text-xs font-semibold uppercase tracking-[0.14em]
                       hover:bg-mustard-400 hover:shadow-glow-sm transition-all duration-400"
          >
            <span>Start Chat</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-ash hover:text-cream transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-navy-950/95 backdrop-blur-2xl border-t border-white/[0.06] px-6 py-5 space-y-3">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNav(link.href)}
              className="block w-full text-left text-sm text-ash hover:text-cream py-2 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

export default memo(Navbar);
