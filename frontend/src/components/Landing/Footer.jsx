// ──────────────────────────────────────────
// Footer — minimal dark footer with hover animations
// ──────────────────────────────────────────
import { memo } from 'react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Knowledge Bases', href: '#knowledge-bases' },
];

const techLinks = [
  'OpenAI GPT-4o',
  'Pinecone',
  'Redis Cloud',
  'HuggingFace',
  'FastAPI',
];

function Footer() {
  const scrollTo = (href) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="relative border-t border-white/[0.06] bg-navy-950">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src="/unnamed.jpg" alt="UOE" className="w-9 h-9 rounded-lg object-cover" />
              <span className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-cream">
                UOE AI
              </span>
            </div>
            <p className="text-sm text-ash leading-relaxed max-w-xs">
              AI-Powered Academic Assistant for University of Education, Lahore.
              Built with self-correcting RAG pipeline technology.
            </p>
          </div>

          {/* Quick Links — with hover underline */}
          <div>
            <h4 className="text-2xs font-medium text-mist uppercase tracking-[0.2em] mb-4">Navigation</h4>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <button
                    onClick={() => scrollTo(link.href)}
                    className="footer-link text-sm text-ash hover:text-cream transition-colors duration-300"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Technology — tag-style */}
          <div>
            <h4 className="text-2xs font-medium text-mist uppercase tracking-[0.2em] mb-4">Technology</h4>
            <div className="flex flex-wrap gap-2">
              {techLinks.map((tech) => (
                <span
                  key={tech}
                  className="inline-block px-3 py-1 rounded-full text-xs text-ash
                             border border-white/[0.06] bg-white/[0.02]
                             hover:border-mustard-500/20 hover:text-cream
                             transition-all duration-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-2xs font-medium text-mist uppercase tracking-[0.2em] mb-4">About</h4>
            <ul className="space-y-2.5">
              <li className="text-sm text-ash">University of Education</li>
              <li className="text-sm text-ash">Lahore, Pakistan</li>
              <li className="text-sm text-ash">Smart RAG Pipeline</li>
              <li className="text-sm text-ash">Self-Correcting Retrieval</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-2xs text-mist/60 tracking-wide">
            © {new Date().getFullYear()} University of Education, Lahore — AI Assistant
          </p>
          <p className="text-2xs text-mist/40 tracking-wide">
            Powered by RAG Pipeline · Smart Self-Correcting Retrieval
          </p>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);
