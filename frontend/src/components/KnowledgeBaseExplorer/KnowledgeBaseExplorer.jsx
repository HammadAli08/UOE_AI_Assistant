// ──────────────────────────────────────────
// KnowledgeBaseExplorer — full-page namespace catalog
// Ivory Archive design system · "Digital Curator" aesthetic
// ──────────────────────────────────────────
import { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  FlaskConical,
  ScrollText,
  Building2,
  Database,
  FileText,
  BookOpen,
  HelpCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import useChatStore from '@/store/useChatStore';
import { SUGGESTIONS } from '@/constants';
import Navbar from '../Landing/Navbar';
import Footer from '../Landing/Footer';

/* ── Namespace data extracted from system prompts ───────────────── */
const KNOWLEDGE_BASES = [
  {
    id: 'bs-adp',
    title: 'BS / ADP Schemes',
    icon: GraduationCap,
    tagline: 'Undergraduate Program Schematics',
    description:
      'Complete structural and course-level coverage of 67 Bachelor of Science (BS) and Associate Degree Program (ADP) schemes. Processed programmatically using layout-aware PDF extraction.',
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
    dataSources: '67 PDF Scheme of Studies documents',
    askExamples: [
      'List all courses in Semester 3 of BS Computer Science.',
      'What are the prerequisites for BS Mathematics?',
      'Show me the course outline for Introduction to Computing.',
      'How many credit hours are in the BS English program?',
    ],
  },
  {
    id: 'rules',
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
      'What is the penalty for using a mobile phone in an exam?',
      'How do I calculate merit for the MS program?',
      'What are the rules for freezing a semester?',
      'Explain the fee refund policy if I drop out in week 2.',
    ],
  },
  {
    id: 'about',
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
      'What is the fee for BS IT in the Evening shift?',
      'Who is the Principal of the Multan Campus?',
      'Does the D.G. Khan campus offer transport facilities?',
      'Give me the contact email for the Registrar Office.',
    ],
  },
  {
    id: 'ms-phd',
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
      'How many credit hours does MS Education require?',
      'What are the specialization tracks for PhD Chemistry?',
      'Tell me about the research requirements for MPhil.',
      'What courses are in Semester 1 of MBA?',
    ],
  },
];

/* ── Scroll-triggered fade-in ───────────────────────────────────── */
function FadeIn({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.19, 1, 0.22, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Individual Knowledge Base Card ─────────────────────────────── */
function KnowledgeBaseCard({ kb, index }) {
  const navigate = useNavigate();
  const setNamespace = useChatStore((s) => s.setNamespace);
  const [isHovered, setIsHovered] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState(null);

  const handleExplore = () => {
    setNamespace(kb.id);
    navigate('/chat');
  };

  const toggleChunk = (key) => {
    setExpandedChunk(expandedChunk === key ? null : key);
  };

  return (
    <FadeIn delay={index * 0.1}>
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{ y: isHovered ? -4 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="h-full"
      >
        <div
          className="relative h-full rounded-2xl overflow-hidden flex flex-col transition-all duration-300"
          style={{
            background: isHovered ? '#131B2E' : '#0F1623',
            border: `1px solid ${isHovered ? 'rgba(200,185,74,0.15)' : 'rgba(255,255,255,0.05)'}`,
          }}
        >
          <div className="p-7 sm:p-9 flex flex-col h-full">
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
                <h3
                  className="font-display text-xl font-semibold tracking-tight leading-tight"
                  style={{ color: '#E8E4DC' }}
                >
                  {kb.title}
                </h3>
                <p
                  className="text-xs mt-1 tracking-wide"
                  style={{ color: 'rgba(200,185,74,0.5)' }}
                >
                  {kb.tagline}
                </p>
              </div>
            </div>

            {/* ── Description ── */}
            <p
              className="text-sm leading-[1.75] mb-8"
              style={{ color: '#8A95A8' }}
            >
              {kb.description}
            </p>

            {/* ── Data Coverage (Chunk Types) ── */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-3.5 h-3.5" style={{ color: 'rgba(200,185,74,0.4)' }} />
                <p
                  className="text-[0.6875rem] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(200,185,74,0.4)' }}
                >
                  Data Coverage
                </p>
              </div>
              <div className="space-y-2">
                {kb.chunkTypes.map((chunk) => (
                  <div key={chunk.key}>
                    <button
                      onClick={() => toggleChunk(chunk.key)}
                      className="w-full flex items-center gap-3 text-left group/chunk rounded-lg px-3 py-2.5 transition-all duration-200"
                      style={{
                        background: expandedChunk === chunk.key ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <FileText
                        className="w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200"
                        style={{ color: expandedChunk === chunk.key ? '#C8B94A' : '#556074' }}
                      />
                      <span
                        className="text-sm font-medium flex-1 transition-colors duration-200"
                        style={{ color: expandedChunk === chunk.key ? '#E8E4DC' : '#8A95A8' }}
                      >
                        {chunk.name}
                      </span>
                      <ChevronRight
                        className={clsx(
                          'w-3 h-3 transition-all duration-200',
                          expandedChunk === chunk.key ? 'rotate-90' : 'rotate-0'
                        )}
                        style={{ color: '#556074' }}
                      />
                    </button>
                    {expandedChunk === chunk.key && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-3 pb-3"
                      >
                        <p
                          className="text-xs leading-relaxed pl-6"
                          style={{
                            color: 'rgba(138,149,168,0.7)',
                            borderLeft: '1px solid rgba(200,185,74,0.1)',
                            paddingLeft: '12px',
                            marginLeft: '2px',
                          }}
                        >
                          {chunk.details}
                        </p>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Example Questions ── */}
            <div className="flex-1 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-3.5 h-3.5" style={{ color: 'rgba(200,185,74,0.4)' }} />
                <p
                  className="text-[0.6875rem] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(200,185,74,0.4)' }}
                >
                  What You Can Ask
                </p>
              </div>
              <ul className="space-y-3">
                {kb.askExamples.map((q, i) => (
                  <li
                    key={i}
                    className="text-xs leading-relaxed pl-4 italic"
                    style={{
                      color: 'rgba(138,149,168,0.65)',
                      borderLeft: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    "{q}"
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Metadata strip ── */}
            <div
              className="flex items-center gap-4 text-[0.625rem] mb-6 py-3 px-4 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.015)',
                color: '#556074',
              }}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3 h-3" />
                {kb.chunkTypes.length} data {kb.chunkTypes.length === 1 ? 'type' : 'types'}
              </span>
              <span
                className="w-px h-3"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              />
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                {kb.dataSources}
              </span>
            </div>

            {/* ── CTA ── */}
            <button
              onClick={handleExplore}
              className="group/btn inline-flex items-center gap-2.5 text-sm font-medium transition-all duration-300 mt-auto"
              style={{ color: '#C8B94A' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#E5D563')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#C8B94A')}
            >
              <span>Explore {kb.title.split(' ')[0]}</span>
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
    return () => {
      document.body.style.overflow = 'hidden';
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      {/* ── Top Navigation Bar ── */}
      <Navbar />

      {/* ── Page Header ── */}
      <section className="relative pt-20 pb-16 sm:pt-28 sm:pb-20">
        {/* Subtle tonal gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(21,27,43,0.4) 0%, transparent 60%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-8 text-center">
          <FadeIn>
            <span
              className="inline-block text-[0.6875rem] font-semibold tracking-[0.3em] uppercase mb-5"
              style={{ color: 'rgba(200,185,74,0.5)' }}
            >
              Knowledge Base Explorer
            </span>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h1
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6"
              style={{ color: '#E8E4DC' }}
            >
              Explore Our Data Sources
            </h1>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p
              className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
              style={{ color: '#8A95A8' }}
            >
              Understand what each knowledge base contains — the types of data stored,
              coverage areas, metadata fields, and the kind of questions you can ask.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Knowledge Base Cards Grid ── */}
      <section className="relative pb-24 sm:pb-32">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {KNOWLEDGE_BASES.map((kb, i) => (
              <KnowledgeBaseCard key={kb.id} kb={kb} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative pb-20 sm:pb-28">
        <FadeIn className="max-w-2xl mx-auto px-6 sm:px-8 text-center">
          <p
            className="text-sm mb-6"
            style={{ color: '#556074' }}
          >
            Ready to ask a question? Pick any knowledge base and start chatting.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary !py-3 !px-8 !text-sm !gap-2.5"
          >
            <span>Open Chat Assistant</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}

export default memo(KnowledgeBaseExplorer);
