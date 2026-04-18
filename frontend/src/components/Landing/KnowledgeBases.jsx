// ──────────────────────────────────────────
// KnowledgeBases — "Ivory Archive" editorial catalog cards
// Academic department selector with clean hierarchy
// Inspired by Stitch "Digital Archivist" design system
// ──────────────────────────────────────────
import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useChatStore from '@/store/useChatStore';
import { NAMESPACES, SUGGESTIONS } from '@/constants';
import ScrollReveal from './ScrollReveal';

const nsDescriptions = {
  'bs-adp': 'Comprehensive information about Bachelor of Science and Associate Degree programs — admissions, fee structures, course outlines, and program durations.',
  'ms-phd': 'Everything about postgraduate research programs — MS/MPhil eligibility, PhD requirements, credit hours, and research guidelines.',
  'rules': 'Official university policies — attendance rules, grading systems, examination procedures, and discipline guidelines.',
};

// Namespace card — editorial catalog style
function NamespaceCard({ ns, index }) {
  const navigate = useNavigate();
  const setNamespace = useChatStore((s) => s.setNamespace);
  const [isHovered, setIsHovered] = useState(false);

  const handleExplore = () => {
    setNamespace(ns.id);
    navigate('/chat');
  };

  return (
    <ScrollReveal index={index}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -3 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative h-full"
      >
        <div
          className="relative h-full rounded-xl overflow-hidden flex flex-col transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <div className="p-8 sm:p-9 flex flex-col h-full">
            {/* Icon & title */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(200,185,74,0.07)',
                  border: '1px solid rgba(200,185,74,0.1)',
                }}
              >
                {(() => {
                  const Icon = ns.icon;
                  return (
                    <Icon
                      className="w-5 h-5"
                      style={{ color: '#C8B94A' }}
                      strokeWidth={1.5}
                    />
                  );
                })()}
              </div>
              <h3
                className="font-display text-[1.125rem] font-semibold tracking-tight"
                style={{ color: '#E8E4DC' }}
              >
                {ns.label}
              </h3>
            </div>

            {/* Description */}
            <p
              className="text-sm leading-[1.7] mb-7"
              style={{ color: '#8A95A8' }}
            >
              {nsDescriptions[ns.id]}
            </p>

            {/* Sample questions — catalog style */}
            <div className="flex-1 mb-8">
              <p
                className="text-[0.6875rem] font-medium tracking-[0.2em] uppercase mb-4"
                style={{ color: 'rgba(200,185,74,0.4)' }}
              >
                Popular Questions
              </p>
              <ul className="space-y-3">
                {(SUGGESTIONS[ns.id] || []).slice(0, 3).map((q) => (
                  <li
                    key={q}
                    className="text-xs leading-relaxed pl-4"
                    style={{
                      color: 'rgba(138,149,168,0.7)',
                      borderLeft: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA — clean text button */}
            <button
              onClick={handleExplore}
              className="group/btn inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
              style={{ color: '#C8B94A' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E5D563')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#C8B94A')}
            >
              <span>Explore {ns.label.split(' ')[0]}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
            </button>
          </div>

          {/* Bottom accent line */}
          <div
            className="h-px w-full mt-auto transition-opacity duration-300"
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

function KnowledgeBases() {
  const navigate = useNavigate();

  return (
    <section id="knowledge-bases" className="relative py-28 sm:py-36">
      {/* Background — clean solid */}
      <div className="absolute inset-0" style={{ background: '#0B1120' }} />

      {/* Subtle tonal shift to separate from adjacent sections */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(21,27,43,0.3) 0%, transparent 20%, transparent 80%, rgba(21,27,43,0.3) 100%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        {/* Section header */}
        <ScrollReveal className="text-center mb-16">
          <span
            className="text-[0.6875rem] font-medium tracking-[0.25em] uppercase block mb-4"
            style={{ color: 'rgba(200,185,74,0.5)' }}
          >
            Knowledge Bases
          </span>
          <h2
            className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-5"
            style={{ color: '#E8E4DC' }}
          >
            Choose Your Domain
          </h2>
          <p
            className="text-base max-w-xl mx-auto leading-relaxed"
            style={{ color: '#8A95A8' }}
          >
            Select a knowledge base to get focused, accurate answers from curated university documents.
          </p>
        </ScrollReveal>

        {/* Namespace cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
          {NAMESPACES.map((ns, i) => (
            <NamespaceCard key={ns.id} ns={ns} index={i} />
          ))}
        </div>

        {/* View All link */}
        <ScrollReveal className="text-center mt-12">
          <button
            onClick={() => navigate('/knowledge-bases')}
            className="group/all inline-flex items-center gap-2.5 text-sm font-medium transition-all duration-300"
            style={{ color: '#C8B94A' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#E5D563')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#C8B94A')}
          >
            <span>View All Knowledge Bases in Detail</span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/all:translate-x-1" />
          </button>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(KnowledgeBases);
