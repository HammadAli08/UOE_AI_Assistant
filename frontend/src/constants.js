// ──────────────────────────────────────────
// Application-wide constants
// ──────────────────────────────────────────
import { GraduationCap, FlaskConical, ScrollText, Building2 } from 'lucide-react';

// In production (Vercel) VITE_API_URL points to the Render backend.
// In local dev the Vite proxy forwards /api → localhost:8000.
// API base URL (from environment variable or fallback to /api for local dev)
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Base URL for non-api health checks (strips /api suffix)
export const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

export const NAMESPACES = [
  { id: 'bs-adp', label: 'BS / ADP Programs', icon: GraduationCap, color: 'brand' },
  { id: 'ms-phd', label: 'MS / PhD Programs', icon: FlaskConical, color: 'indigo' },
  { id: 'rules',  label: 'Rules & Regulations', icon: ScrollText, color: 'amber' },
  { id: 'about',  label: 'About UOE', icon: Building2, color: 'teal' },
];

export const DEFAULT_NAMESPACE = 'about';

export const SUGGESTIONS = {
  'bs-adp': [
    'BS Computer Science me admisson requirement kya hain?',
    'What is Prerequisite of Compiler Construction?',
    'Bs Botany mein doosre semester mein kya subjects ho sakte hain?',
    'What are module aims for Plant Systematics, Anatomy and Development?',
  ],
  'ms-phd': [
    'MS Botany ke lie eligibility criteria kya he?',
    'What is the pre-requisite degree for admission to the MSc Zoology program, and which subjects are mandatory?',
    'what are semester 1 subjects in MS Computer Science',
    'What are the Course Objectives for Advanced Software Engineering?',
  ],
  'rules': [
    'What is the Hostel guest policy?',
    'Shift change kese karwa sakte hain?',
    'What are Fee refund rules?',
    'Explain the grading system',
  ],
  'about': [
    'Give me an overview of University of Education.',
    'Can you tell me about the University of Education Faisalabad Campus?',
    'Summarize key student rules and important procedures.',
    'What facilities and student services does the university offer?',
  ],
};

export const MAX_QUERY_LENGTH = 2000;
export const MAX_TURNS = 10;
export const SESSION_TTL_MINUTES = 30;

export const AGENTIC_RAG_STATES = {
  PASS:        { label: 'Pass',        color: 'green',  desc: 'All chunks were relevant on first retrieval' },
  RETRY:       { label: 'Retry',       color: 'amber',  desc: 'Query was rewritten to find better results' },
  BEST_EFFORT: { label: 'Best Effort', color: 'blue',   desc: 'Used the best available chunks after retries' },
  FALLBACK:    { label: 'Fallback',    color: 'red',    desc: 'No relevant chunks found' },
  DIRECT:      { label: 'Direct',      color: 'green',  desc: 'Answered directly without document retrieval' },
  DECOMPOSE:   { label: 'Decomposed',  color: 'blue',   desc: 'Complex query was split into sub-questions' },
  CLARIFY:     { label: 'Clarify',     color: 'amber',  desc: 'Asked for more details to improve search' },
  GROUNDED:    { label: 'Verified',    color: 'green',  desc: 'Answer verified against source documents' },
  UNGROUNDED:  { label: 'Check',       color: 'amber',  desc: 'Some claims may not be directly from sources' },
};
