// ──────────────────────────────────────────
// Application-wide constants
// ──────────────────────────────────────────

// In production (Vercel) VITE_API_URL points to the Render backend.
// In local dev the Vite proxy forwards /api → localhost:8000.
// API base URL (from environment variable or fallback to /api for local dev)
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Base URL for non-api health checks (strips /api suffix)
export const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

export const NAMESPACES = [
  { id: 'bs-adp', label: 'BS / ADP Programs', icon: '🎓', color: 'brand' },
  { id: 'ms-phd', label: 'MS / PhD Programs', icon: '🔬', color: 'indigo' },
  { id: 'rules',  label: 'Rules & Regulations', icon: '📋', color: 'amber' },
];

export const DEFAULT_NAMESPACE = 'bs-adp';

export const SUGGESTIONS = {
  'bs-adp': [
    'BS Computer Science me admisson requirement kya hain?',
    'What is Prerequisite of Compiler Construction?',
    'What is course code for Functional English?',
    'What are module aims for Plant Systematics, Anatomy and Development?',
  ],
  'ms-phd': [
    'MS Botany ke lie eligibility criteria kya he?',
    'How many credit hours are required for PhD?',
    'Tell me about the research requirements',
    'What are the Course Objectives for Advanced Software Engineering?',
  ],
  'rules': [
    'What is the Hostel guest policy?',
    'Shift change kese karwa sakte hain?',
    'What are Fee refund rules?',
    'Explain the grading system',
  ],
};

export const MAX_QUERY_LENGTH = 2000;
export const MAX_TURNS = 10;
export const SESSION_TTL_MINUTES = 30;

export const SMART_RAG_STATES = {
  PASS:        { label: 'Pass',        color: 'green',  desc: 'All chunks were relevant on first retrieval' },
  RETRY:       { label: 'Retry',       color: 'amber',  desc: 'Query was rewritten to find better results' },
  BEST_EFFORT: { label: 'Best Effort', color: 'blue',   desc: 'Used the best available chunks after retries' },
  FALLBACK:    { label: 'Fallback',    color: 'red',    desc: 'No relevant chunks found, generated from general knowledge' },
};
