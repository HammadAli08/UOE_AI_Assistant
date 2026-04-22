// ──────────────────────────────────────────
// KnowledgeBaseExplorer — full-page namespace catalog
// Ivory Archive design system · "Digital Curator" aesthetic
// ──────────────────────────────────────────
import { memo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  GraduationCap,
  FlaskConical,
  ScrollText,
  Building2,
  Database,
  FileText,
  HelpCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import Navbar from '../Landing/Navbar';
import Footer from '../Landing/Footer';

/* ── Constants & Enriched Data ───────────────────────────────────────── */

const KNOWLEDGE_BASES = [
  {
    id: 'bs-adp',
    index: '01',
    title: 'BS / ADP Schemes',
    icon: GraduationCap,
    tagline: 'Undergraduate Program Schematics',
    description:
      'Complete structural and course-level coverage of over 160 Bachelor of Science (BS) and Associate Degree Program (ADP) schemes. Processed programmatically using layout-aware PDF extraction.',
    chunkTypes: [
      {
        name: 'Program Summary',
        key: 'program_summary',
        details:
          'High-level degree prerequisites, total credit hours, core/elective credit breakdowns, and overall degree requirements.',
      },
      {
        name: 'Semester Subjects',
        key: 'semester_subjects',
        details:
          'Lists of courses mapped to specific semesters. Provides the course code, title, and credit hour breakdown for a given semester.',
      },
      {
        name: 'Course Outline',
        key: 'course',
        details:
          'Deep-dive into individual courses including objective, textbook recommendations, grading rubrics, and week-by-week curriculum contents.',
      },
    ],
    metadataFields: [
      'program_name',
      'degree_type',
      'department',
      'semester',
      'course_code',
      'course_title',
      'chunk_type',
      'source_file',
    ],
    dataSources: '160+ PDF Scheme of Studies documents',
    askExamples: [
      "What subjects are in Semester 4 of BS Computer Science at UOE?",
      "How many total credit hours does the BS Software Engineering program require?",
      "What is the course outline for Data Structures — what topics are covered week by week?",
      "Which elective courses are available in the final year of BS Mathematics?",
      "What are the prerequisites for the Compiler Construction course?",
      "Show me all ADP programs and their duration at University of Education"
    ],
  },
  {
    id: 'rules',
    index: '02',
    title: 'Rules & Regulations',
    icon: ScrollText,
    tagline: 'Academic Policies & Disciplinary Codes',
    description:
      'Official, Syndicate-approved regulatory documents spanning 2022-2024. Uses regulation-boundary-aware retrieval to ensure clauses and penalties are never cut in half.',
    chunkTypes: [
      {
        name: 'Admissions & Exams',
        key: 'admission_examination',
        details:
          'Eligibility criteria, merit formulas, grading policies, CGPA rules, probation thresholds, and degree issuance processes. Separated by UG/Grad/PhD.',
      },
      {
        name: 'Discipline & Conduct',
        key: 'disciplinary',
        details:
          'Code of conduct, hostel discipline rules, and Unfair Means Cases (UMC) regulations, including exact penalty tiers.',
      },
      {
        name: 'Financial & Fee Rules',
        key: 'fee_financial',
        details:
          'Tuition fee policies, refund rules, installment policies, and financial assistance/scholarship procedures.',
      },
      {
        name: 'Administrative Policies',
        key: 'administrative',
        details:
          'Library rules, semester freezing procedures, migration tracking, and examination centre constitution.',
      },
    ],
    metadataFields: [
      'doc_type',
      'topic_cluster',
      'regulations_scope',
      'effective_year',
      'authority',
      'source_file',
      'page_number',
    ],
    dataSources: '21 Authenticated PDF Regulatory Documents (2022-2024)',
    askExamples: [
      "What happens if a student is caught using a mobile phone during an exam?",
      "How is merit calculated for MS program admissions?",
      "Can I freeze my semester, and what is the procedure for doing so?",
      "What is the fee refund policy if I withdraw in the first two weeks?",
      "What CGPA is required to avoid academic probation?",
      "What are the hostel discipline rules and penalties for violations?"
    ],
  },
  {
    id: 'about',
    index: '03',
    title: 'About University',
    icon: Building2,
    tagline: 'Institutional Data & Directories',
    description:
      'Comprehensive, highly structured factual data about the University of Education, encompassing 5 distinct high-fidelity JSON data streams.',
    chunkTypes: [
      {
        name: 'Program Directory',
        key: 'program_summary',
        details:
          'Summaries of 90+ programs across all campuses, including admission requirements and program scope.',
      },
      {
        name: 'Fee Structures',
        key: 'program_fee',
        details:
          'Exact numeric fee data for Morning and Evening shifts, broken out programmatically to eliminate hallucination.',
      },
      {
        name: 'Contact Directory',
        key: 'contact_directory',
        details:
          'Over 30 contact nodes detailing phone numbers and emails for VCs, Principals, Registrars, and department heads.',
      },
      {
        name: 'Campus & Facilities',
        key: 'campus_overview',
        details:
          'Information on 9 distinct campuses, transport facilities, libraries, IT labs, and research centers.',
      },
      {
        name: 'Faculty Profiles',
        key: 'faculty_profile',
        details:
          'Current faculty lists, designations, qualifications, and department affiliations.',
      },
    ],
    metadataFields: [
      'campus_name',
      'person_name',
      'person_title',
      'facility_type',
      'shift',
      'program',
      'source_file',
    ],
    dataSources: '5 Synthesized JSON Datasets',
    askExamples: [
      "What is the fee structure for BS IT in the Evening shift at the Lahore campus?",
      "Who is the Principal of the Multan Campus and what is their contact number?",
      "Does the D.G. Khan campus have transport facilities for students?",
      "What is the email address of the Registrar's office?",
      "Which campuses offer BS Computer Science and what are the morning/evening fees?",
      "How many campuses does the University of Education have and where are they located?"
    ],
  },
  {
    id: 'ms-phd',
    index: '04',
    title: 'MS / PhD Programs',
    icon: FlaskConical,
    tagline: 'Postgraduate Schemes of Studies',
    description:
      'Detailed information about MS, MPhil, and PhD postgraduate programs — including coursework/research splits, specialization tracks, and phased degree structures.',
    chunkTypes: [
      {
        name: 'Program Summary',
        key: 'program_summary',
        details:
          'Degree credit totals, coursework vs. research/thesis split, specialization tracks, admission requirements, CGPA rules, degree award conditions.',
      },
      {
        name: 'Semester Subjects',
        key: 'semester_subjects',
        details:
          'Full course list per semester or phase — code, title, credits, Core/Elective label, with specialization-specific grouping.',
      },
      {
        name: 'Course Outline',
        key: 'course',
        details:
          'Complete outline with objectives, contents, books, prerequisites, learning outcomes, methodology, and specialization label.',
      },
    ],
    metadataFields: [
      'program_name',
      'degree_type',
      'batch_year',
      'specialization',
      'semester',
      'course_category',
      'prerequisites',
      'source_file',
      'page_number',
    ],
    dataSources: 'Postgraduate PDF Schemes',
    askExamples: [
      "How many credit hours are required to complete the MS Education program?",
      "What are the specialization tracks available for PhD Chemistry students?",
      "What is the coursework vs research split for MPhil programs?",
      "Which courses are in Semester 1 of the MBA program?",
      "What CGPA is required to qualify for PhD admission?",
      "What are the thesis submission requirements for MS students?"
    ],
  },
];

/* ── Hooks ──────────────────────────────────────────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

/* ── UI Components ─────────────────────────────────────────────────── */

function FadeIn({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay, ease: [0.19, 1, 0.22, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatItem({ metric, label }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const count = useAnimatedCounter(metric, isVisible);

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
    <div ref={ref} className="flex flex-col gap-1">
      <div className="text-2xl font-display font-bold text-mustard-500">
        {count}{label === "PDF Documents" ? "+" : ""}
      </div>
      <div className="text-[0.625rem] font-bold uppercase tracking-[0.2em] text-ash/40">
        {label}
      </div>
    </div>
  );
}

function KnowledgeBaseCard({ kb, index }) {
  const navigate = useNavigate();
  const setNamespace = useChatStore((s) => s.setNamespace);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState(null);

  const handleExplore = () => {
    setNamespace(kb.id);
    navigate('/chat');
  };

  return (
    <FadeIn delay={index * 0.1}>
      <motion.div
        id={`kb-${kb.id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="h-full scroll-mt-32"
      >
        <div
          className="relative h-full rounded-2xl overflow-hidden flex flex-col transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          {/* Watermark Index */}
          <div 
            className="absolute top-4 right-6 font-display text-[7rem] font-black leading-none pointer-events-none select-none transition-opacity duration-300"
            style={{ color: 'rgba(200,185,74,0.04)', opacity: isHovered ? 0.08 : 0.04 }}
          >
            {kb.index}
          </div>

          <div className="p-7 sm:p-9 flex flex-col h-full relative z-10">
            {/* ── Header ── */}
            <div className="flex items-start gap-4 mb-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(200,185,74,0.07)',
                  border: '1px solid rgba(200,185,74,0.12)',
                }}
              >
                {(() => {
                  const Icon = kb.icon;
                  return <Icon className="w-5.5 h-5.5" style={{ color: '#C8B94A' }} strokeWidth={1.5} />;
                })()}
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-[#E8E4DC] leading-tight">
                  {kb.title}
                </h3>
                <p className="text-xs mt-1 tracking-wide" style={{ color: 'rgba(200,185,74,0.5)' }}>
                  {kb.tagline}
                </p>
              </div>
            </div>

            {/* ── Description ── */}
            <p className="text-sm leading-[1.75] mb-8 text-[#8A95A8]">
              {kb.description}
            </p>


            {/* ── Data Architecture Accordion ── */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-3.5 h-3.5 text-mustard-500/40" />
                <p className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-mustard-500/40">
                  Data Architecture
                </p>
              </div>
              <div className="space-y-2">
                {kb.chunkTypes.map((chunk) => (
                  <div key={chunk.key}>
                    <button
                      onClick={() => setExpandedChunk(expandedChunk === chunk.key ? null : chunk.key)}
                      className="w-full flex items-center gap-3 text-left group/chunk rounded-lg px-3 py-2.5 transition-all duration-200"
                      style={{ background: expandedChunk === chunk.key ? 'rgba(200,185,74,0.02)' : 'transparent' }}
                    >
                      <div 
                        className={clsx(
                          "w-1.5 h-1.5 rounded-full transition-all duration-300",
                          expandedChunk === chunk.key ? "bg-mustard-500 scale-125" : "bg-mustard-500/30"
                        )} 
                      />
                      <span className={clsx(
                        "text-sm font-medium flex-1 transition-colors duration-200 font-display",
                        expandedChunk === chunk.key ? "text-[#E8E4DC]" : "text-[#8A95A8]"
                      )}>
                        {chunk.name}
                      </span>
                      <ChevronRight className={clsx(
                        "w-3 h-3 transition-all duration-200 text-mist/30",
                        expandedChunk === chunk.key ? "rotate-90 text-mustard-500" : "rotate-0"
                      )} />
                    </button>
                    <AnimatePresence>
                      {expandedChunk === chunk.key && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-3.5 pl-4 py-3 border-l border-mustard-500/20 bg-white/[0.01] rounded-r-lg">
                            <p className="text-[0.75rem] leading-relaxed text-[#8A95A8]/80">
                              {chunk.details}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Example Questions ── */}
            <div className="mb-8 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-3.5 h-3.5 text-mustard-500/40" />
                <p className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-mustard-500/40">
                  Inquiry Examples
                </p>
              </div>
              <ul className="space-y-3">
                {kb.askExamples.map((q, i) => (
                  <li key={i} className="text-[0.75rem] leading-relaxed pl-4 italic text-[#8A95A8]/50 border-l border-white/[0.05]">
                    "{q}"
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Metadata Tags ── */}
            <div className="mb-10">
               <div className="flex items-center gap-2 mb-4">
                <Layers className="w-3.5 h-3.5 text-mustard-500/40" />
                <p className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-mustard-500/40">
                  Reference Keys
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kb.metadataFields.map(field => (
                  <span key={field} className="rounded px-2 py-0.5 text-[0.625rem] font-mono bg-white/[0.02] border border-white/[0.04] text-[#556074] hover:border-mustard-500/20 hover:text-mustard-500/60 transition-colors cursor-default">
                    {field}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Upgraded CTA Button ── */}
            <button
              onClick={handleExplore}
              className="group/btn inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold mt-auto transition-all duration-300
                         bg-mustard-500/5 border border-mustard-500/10 text-mustard-500
                         hover:bg-mustard-500/10 hover:border-mustard-500/25 active:scale-[0.98]"
            >
              <span>Query {kb.title.split(' ')[0]} Repository</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </button>
          </div>

          {/* Card bottom accent line */}
          <div 
            className="h-px w-full transition-opacity duration-300"
            style={{ background: '#C8B94A', opacity: isHovered ? 0.25 : 0.06 }} 
          />
        </div>
      </motion.div>
    </FadeIn>
  );
}

/* ── Main Page Component ────────────────────────────────────────── */

function KnowledgeBaseExplorer() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = 'hidden'; };
  }, []);

  const scrollToKB = (id) => {
    const el = document.getElementById(`kb-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen selection:bg-mustard-500/30" style={{ background: '#0B1120' }}>
      <Navbar />

      {/* ── 1. CINEMATIC HERO SECTION ── */}
      <section className="relative min-h-[65vh] flex items-end pt-52 pb-24 overflow-hidden">
        {/* Layered Background Effects */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[#0B1120]" />
          
          {/* Background Image Layer */}
          <div 
            className="absolute inset-0 opacity-40 mix-blend-luminosity pointer-events-none"
            style={{ 
              backgroundImage: "url('/knowledge_base_background.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0B1120] to-transparent z-10" />
          
          {/* Radial Glows */}
          <div 
             className="absolute top-1/2 left-[20%] -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[140px] opacity-40 animate-glow-pulse"
             style={{ background: 'radial-gradient(ellipse at center, rgba(200,185,74,0.06) 0%, transparent 70%)' }}
          />
          <div 
             className="absolute top-0 right-[10%] w-[600px] h-[400px] rounded-full blur-[140px] opacity-30"
             style={{ background: 'radial-gradient(ellipse at center, rgba(100,120,200,0.03) 0%, transparent 70%)' }}
          />
          
          {/* Grid Overlay */}
          <div 
            className="absolute inset-0 opacity-[0.015]"
            style={{ 
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '72px 72px'
            }}
          />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-6 sm:px-8 w-full">
          <div className="max-w-3xl">
            <FadeIn>
              <span className="inline-block text-[0.6875rem] font-bold tracking-[0.3em] uppercase text-mustard-500/60 mb-5">
                Vault / Knowledge Bases
              </span>
            </FadeIn>
            
            <FadeIn delay={0.1}>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-[#E8E4DC] leading-[1.05] tracking-tight">
                Explore Our <br />
                <span className="text-mustard-500/70 italic font-light">Data Sources</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="text-lg text-[#8A95A8] max-w-lg mt-6 leading-relaxed font-light">
                Four specialized repositories governing the entire University of Education ecosystem. 
                Every response generated is strictly grounded in these verified sources.
              </p>
            </FadeIn>

            {/* Horizontal Stat Strip */}
            <FadeIn delay={0.3}>
              <div className="flex flex-wrap items-center gap-x-12 gap-y-6 mt-12 pt-10 border-t border-white/[0.05]">
                <StatItem metric={4} label="Knowledge Bases" />
                <div className="hidden sm:block w-px h-8 bg-white/[0.06]" />
                <StatItem metric={160} label="PDF Documents" />
                <div className="hidden sm:block w-px h-8 bg-white/[0.06]" />
                <StatItem metric={90} label="Programs Tracked" />
                <div className="hidden sm:block w-px h-8 bg-white/[0.06]" />
                <StatItem metric={21} label="Regulatory Files" />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── 2. STICKY NAVIGATION STRIP ── */}
      <div className="sticky top-[72px] z-40 w-full border-y border-white/[0.04] bg-[#0B1120]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[0.625rem] uppercase tracking-widest text-[#8A95A8]/50 font-bold">
            Catalogued Repositories (4)
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'bs-adp', label: 'BS/ADP' },
              { id: 'rules', label: 'Rules' },
              { id: 'about', label: 'About UOE' },
              { id: 'ms-phd', label: 'MS/PhD' }
            ].map(nav => (
              <button
                key={nav.id}
                onClick={() => scrollToKB(nav.id)}
                className="rounded-full px-3 py-1 text-[0.625rem] font-bold tracking-wider uppercase border border-white/[0.08] text-mist/60 hover:text-mustard-500 hover:border-mustard-500/30 bg-white/[0.02] transition-all"
              >
                {nav.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3. CARDS GRID ── */}
      <section className="relative py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {KNOWLEDGE_BASES.map((kb, i) => (
              <KnowledgeBaseCard key={kb.id} kb={kb} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Subtle Section Divider ── */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      {/* ── 4. BOTTOM CTA BANNER — CTABanner Style ── */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0 bg-navy-950" />
        
        {/* Ambient Gradient Layout */}
        <div 
          className="absolute inset-0 opacity-60 ambient-gradient" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(200,185,74,0.04) 0%, rgba(100,120,200,0.03) 25%, rgba(140,147,64,0.04) 50%, rgba(200,185,74,0.03) 75%, rgba(100,120,200,0.04) 100%)', 
            backgroundSize: '300% 300%' 
          }} 
        />
        
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full blur-[180px] opacity-70"
          style={{ background: 'radial-gradient(circle, rgba(200,185,74,0.06) 0%, transparent 70%)' }} 
        />
        
        <FadeIn className="relative z-10 max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-bold uppercase text-cream tracking-tight mb-5 leading-tight">
            Ready to Ask a <br />
            <span className="bg-gradient-to-r from-mustard-400 via-mustard-500 to-olive-400 bg-clip-text text-transparent">
              Question?
            </span>
          </h2>
          <p className="text-base text-ash max-w-md mx-auto leading-relaxed mb-10 font-light">
            Select any knowledge base above and start chatting. Our AI architecture ensures 
            every response is derived directly from the verified academic vault.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/chat')} 
              className="btn-primary group"
            >
              <span>Open Chat Assistant</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
              className="btn-ghost"
            >
              <span>Explore Repositories ↑</span>
            </button>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}

export default memo(KnowledgeBaseExplorer);
