"""
canonical_ms_phd_ingestion.py
=============================================================================
Production-grade PDF ingestion pipeline for MS, MPhil, MA, M.Ed., MBA,
PhD & PGD Scheme of Studies.

SOURCE:  55 PDF files in Data/Ms&Phd/
TARGET:  Pinecone index `uoeaiassistant`, namespace `ms-phd-schemes`
EMBED:   OpenAI text-embedding-3-large (dim=3072)

ARCHITECTURE:
  1. Load each PDF via PyPDFLoader
  2. Apply course-boundary-aware semantic chunking
  3. Extract rich metadata per chunk (program, degree, semester, course, etc.)
  4. Normalize chunk_type to 6 canonical types (SAME as BS/ADP)
  5. Construct embedding text with metadata header
  6. Generate deterministic vector IDs
  7. Strip null metadata values (Pinecone rejects null)
  8. Embed in batches via OpenAI
  9. Upsert in batches to Pinecone

CANONICAL CHUNK TYPES (identical to bs-adp-schemes):
  program_overview    — intro, objectives, vision, mission, policies, study tours
  admission           — admission requirements only
  program_design      — credit distribution, degree requirements, thesis, deficiency
  semester_subjects   — one per semester (per specialization where applicable)
  course_detail       — one per course (atomic, self-contained)
  list_chunk          — elective tables, specialization tracks, fee tables

USAGE:
    python canonical_ms_phd_ingestion.py                         # Full ingestion
    python canonical_ms_phd_ingestion.py --dry-run               # Parse + validate only
    python canonical_ms_phd_ingestion.py --resume                # Skip already processed
    python canonical_ms_phd_ingestion.py --single-file "MA History (2018).pdf"
=============================================================================
"""

import os
import re
import sys
import json
import hashlib
import logging
import argparse
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from datetime import datetime
from collections import defaultdict

from dotenv import load_dotenv

# ─── Load .env ───────────────────────────────────────────────────────────────
_backend_dir = Path("/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend")
load_dotenv(_backend_dir / ".env")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PINECONE_INDEX   = "uoeaiassistant"
PINECONE_NS      = "ms-phd-schemes"
PINECONE_DIM     = 3072

OPENAI_MODEL     = "text-embedding-3-large"
EMBED_BATCH      = 20        # texts per OpenAI call
UPSERT_BATCH     = 100       # vectors per Pinecone upsert

DATA_DIR = Path(
    "/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT"
    "/backend/Data/Ms&Phd"
)

LOG_FILE = _backend_dir / "Data_Ingestion" / "ms_phd_ingestion.log"
PROGRESS_FILE = _backend_dir / "Data_Ingestion" / "ms_phd_ingestion_progress.json"

# Chunk sizing
CHUNK_SIZE     = 1000
CHUNK_OVERLAP  = 150
MIN_CHUNK_SIZE = 80
MAX_CHUNK_SIZE = 2500

# Course-boundary-aware separators (highest priority first)
SEPARATORS = [
    "\n\n## ",
    "\n### ",
    "\nCourse Code:",
    "\nCourse Title:",
    "\nSemester -",
    "\nSemester –",
    "\nSemester-",
    "\nSEMESTER",
    "\nPrerequisites:",
    "\nCourse Objectives:",
    "\nCLO",
    "\nLearning Outcomes:",
    "\nRecommended Books",
    "\nSuggested Readings",
    "\n\n",
    "\n",
    ". ",
    " ",
]

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# FILE → PROGRAM MAPPING
# ═════════════════════════════════════════════════════════════════════════════

# (program_name, degree_type, department, year)
FILE_PROGRAM_MAP: Dict[str, Tuple[str, str, str, int]] = {
    # MSc programs
    "MSc Physics (2016).pdf":            ("MSc Physics", "MSc", "Physics", 2016),
    "MSc Physics (2018).pdf":            ("MSc Physics", "MSc", "Physics", 2018),
    "MSc Chemistry (2018).pdf":          ("MSc Chemistry", "MSc", "Chemistry", 2018),
    "MSc Mathematics (2018).pdf":        ("MSc Mathematics", "MSc", "Mathematics", 2018),
    "MSc Zoology (2018).pdf":            ("MSc Zoology", "MSc", "Zoology", 2018),
    "MSc Botany (2018).pdf":             ("MSc Botany", "MSc", "Botany", 2018),
    "MSc Economics (2018).pdf":          ("MSc Economics", "MSc", "Economics", 2018),
    "MSc Information Technology (2018).pdf": ("MSc Information Technology", "MSc", "Information Technology", 2018),
    # MA programs
    "MA History (2018).pdf":             ("MA History", "MA", "History", 2018),
    "MA Education (2018).pdf":           ("MA Education", "MA", "Education", 2018),
    "MA English (2019).pdf":             ("MA English", "MA", "English", 2019),
    "MA Urdu (2016).PDF":                ("MA Urdu", "MA", "Urdu", 2016),
    "MA Speical Education (2018).pdf":   ("MA Special Education", "MA", "Special Education", 2018),
    "MA Education (Leadership and Management) (2016).pdf": ("MA Education (Leadership and Management)", "MA", "Education", 2016),
    # M.Ed. programs
    "M.Ed. (2016).pdf":                  ("MEd", "M.Ed.", "Education", 2016),
    "M.Ed. Special Education (2018).pdf": ("MEd Special Education", "M.Ed.", "Special Education", 2018),
    # MBA programs
    "MBA (1.5 years) (2018).pdf":        ("MBA 1.5 Year", "MBA", "Business Administration", 2018),
    "MBA (3.5 Years) (2018).pdf":        ("MBA 3.5 Years", "MBA", "Business Administration", 2018),
    "MBA (Revised 2021).pdf":            ("MBA", "MBA", "Business Administration", 2021),
    # MPhil programs
    "MPhil Education (2023).pdf":        ("MPhil Education", "MPhil", "Education", 2023),
    "MPhil Urdu (2022).pdf":             ("MPhil Urdu", "MPhil", "Urdu", 2022),
    "MPhil Economics (2018).pdf":        ("MPhil Economics", "MPhil", "Economics", 2018),
    "MPhil English (Linguistics)(2023) (Revised in 2024).pdf": ("MPhil English (Linguistics)", "MPhil", "English", 2024),
    "MPhil English (Literature) (2022).pdf": ("MPhil English (Literature)", "MPhil", "English", 2022),
    "MPhil Educational Leadership and Policy Studies (2023).pdf": ("MPhil Educational Leadership and Policy Studies", "MPhil", "Educational Leadership and Policy Studies", 2023),
    "MPhil History, Arts and Cultural Heritage (2023).pdf": ("MPhil History Arts and Cultural Heritage", "MPhil", "History", 2023),
    "MPhil Islamic Studies (2022).pdf":  ("MPhil Islamic Studies", "MPhil", "Islamic Studies", 2022),
    "MPhil Special Education (2023).pdf": ("MPhil Special Education", "MPhil", "Special Education", 2023),
    # MS programs
    "MS Botany (2023).pdf":              ("MS Botany", "MS", "Botany", 2023),
    "MS Chemistry (2018).pdf":           ("MS Chemistry", "MS", "Chemistry", 2018),
    "MS Comuter Science (2023).pdf":     ("MS Computer Science", "MS", "Computer Science", 2023),
    "MS Information Technology (2020).pdf": ("MS Information Technology", "MS", "Information Technology", 2020),
    "MS Mathematics (2018).pdf":         ("MS Mathematics", "MS", "Mathematics", 2018),
    "MS Physics (2018) (Revised in 2024).pdf": ("MS Physics", "MS", "Physics", 2024),
    "MS Zoology (2023).pdf":             ("MS Zoology", "MS", "Zoology", 2023),
    "13-MS Management Science (2022).pdf": ("MS Management Sciences", "MS", "Management Sciences", 2022),
    # PhD programs
    "PhD Education (2018).pdf":          ("PhD Education", "PhD", "Education", 2018),
    "PhD Botany (2023).pdf":             ("PhD Botany", "PhD", "Botany", 2023),
    "PhD Chemistry (2023).pdf":          ("PhD Chemistry", "PhD", "Chemistry", 2023),
    "PhD Economics (2020).pdf":          ("PhD Economics", "PhD", "Economics", 2020),
    "PhD English (Linguistics) (2019) (Revised in 2024).pdf": ("PhD English (Linguistics)", "PhD", "English", 2024),
    "PhD Educational Leadership and Policy Studies (2023).pdf": ("PhD Educational Leadership and Policy Studies", "PhD", "Educational Leadership and Policy Studies", 2023),
    "PhD History, Arts and Cultural Heritage (2023).pdf": ("PhD History Arts and Cultural Heritage", "PhD", "History", 2023),
    "PhD Islamic Studies (2022).pdf":    ("PhD Islamic Studies", "PhD", "Islamic Studies", 2022),
    "PhD Management Sciences (2022).pdf": ("PhD Management Sciences", "PhD", "Management Sciences", 2022),
    "PhD Mathematics (2018).pdf":        ("PhD Mathematics", "PhD", "Mathematics", 2018),
    "PhD Physics (2019) (Revised in 2024).pdf": ("PhD Physics", "PhD", "Physics", 2024),
    "PhD Special Education (2023).pdf":  ("PhD Special Education", "PhD", "Special Education", 2023),
    "PhD Urdu (2022).pdf":               ("PhD Urdu", "PhD", "Urdu", 2022),
    "PhD Zoology (2023).pdf":            ("PhD Zoology", "PhD", "Zoology", 2023),
    # PGD programs
    "PGD (ASD) (2022).pdf":              ("PGD ASD", "PGD", "Special Education", 2022),
    "PGD (SLT) (2018).pdf":              ("PGD SLT", "PGD", "Special Education", 2018),
    # Fee structure
    "fee_structure (1).pdf":             ("Fee Structure", "ALL", "Administration", 2024),
}


# ═════════════════════════════════════════════════════════════════════════════
# METADATA EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════

def resolve_file_metadata(filename: str) -> Tuple[str, str, str, int]:
    """Get program_name, degree_type, department, year from filename map."""
    if filename in FILE_PROGRAM_MAP:
        return FILE_PROGRAM_MAP[filename]

    # Fallback: infer from filename
    name = filename.replace(".pdf", "").replace(".PDF", "")
    name = re.sub(r'^\d+-\s*', '', name)
    name = re.sub(r'\s*\(\d{4}\)', '', name)
    name = re.sub(r'\s*\(Revised in \d{4}\)', '', name)
    name = re.sub(r'\s+', ' ', name).strip()

    # Infer degree type
    fn_upper = filename.upper()
    degree_type = "Unknown"
    if "PHD" in fn_upper:
        degree_type = "PhD"
    elif "MPHIL" in fn_upper:
        degree_type = "MPhil"
    elif "MSC" in fn_upper:
        degree_type = "MSc"
    elif fn_upper.startswith("MS ") or "MS " in fn_upper:
        degree_type = "MS"
    elif "MBA" in fn_upper:
        degree_type = "MBA"
    elif "M.ED" in fn_upper:
        degree_type = "M.Ed."
    elif fn_upper.startswith("MA ") or "MA " in fn_upper:
        degree_type = "MA"
    elif "PGD" in fn_upper:
        degree_type = "PGD"

    # Infer year
    year_matches = re.findall(r'\((\d{4})\)', filename)
    year = int(year_matches[0]) if year_matches else 0

    return (name, degree_type, "General", year)


ROMAN_MAP = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4,
    'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8,
    'IX': 9, 'X': 10, 'XI': 11, 'XII': 12,
}


def extract_course_code(text: str) -> str:
    """Extract course code like EDUC8112, HIST3116."""
    patterns = [
        r'Course Code[:\s]+([A-Z]{2,4}\s*\d{3,4})',
        r'\b([A-Z]{2,4})\s*[-]?\s*(\d{4})\b',
        r'\b([A-Z]{2,4})\s*[-]?\s*(\d{3})\b',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            if m.lastindex and m.lastindex >= 2:
                code = (m.group(1) + m.group(2)).replace(' ', '').replace('-', '').upper()
            else:
                code = m.group(1).replace(' ', '').replace('-', '').upper()
            if re.match(r'^[A-Z]{2,4}\d{3,4}$', code):
                return code
    return ""


def extract_course_title(text: str) -> str:
    """Extract course title."""
    patterns = [
        r'Course Title[:\s]+([^\n]+)',
        r'Course Name[:\s]+([^\n]+)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            title = re.sub(r'\s+', ' ', title)[:120]
            return title
    return ""


def extract_credit_hours(text: str) -> str:
    """Extract credit hours like 3(3+0), 4(3+1)."""
    m = re.search(r'(\d)\s*\(\s*(\d)\s*[+\-]\s*(\d)\s*\)', text)
    if m:
        return f"{m.group(1)}({m.group(2)}+{m.group(3)})"
    m = re.search(r'Credit Hours?[:\s]+(\d\(\d\+\d\))', text, re.IGNORECASE)
    if m:
        return m.group(1)
    return ""


def extract_semester(text: str) -> int:
    """Extract first semester number (0 if not found)."""
    all_sems = extract_all_semesters(text)
    return all_sems[0] if all_sems else 0


def extract_all_semesters(text: str) -> List[int]:
    """
    Extract ALL semester numbers from text.
    Multi-semester pages (e.g., Sem I + II on one page) need all values
    stored to enable precise semester-based filtering.
    """
    semesters: set = set()

    # Roman numeral semesters: "Semester – III", "Semester-IV"
    for m in re.finditer(r'Semester\s*[-–—]?\s*([IVX]+)', text, re.IGNORECASE):
        val = m.group(1).upper().strip()
        if val in ROMAN_MAP:
            semesters.add(ROMAN_MAP[val])

    # Digit semesters: "Semester 5", "Semester-2"
    for m in re.finditer(r'Semester\s*[-–—]?\s*(\d{1,2})', text, re.IGNORECASE):
        try:
            n = int(m.group(1))
            if n >= 1:
                semesters.add(n)
        except ValueError:
            pass

    # Ordinal: "5th Semester"
    for m in re.finditer(r'(\d{1,2})(?:st|nd|rd|th)\s+Semester', text, re.IGNORECASE):
        try:
            n = int(m.group(1))
            if n >= 1:
                semesters.add(n)
        except ValueError:
            pass

    return sorted(semesters)


def detect_language(text: str) -> str:
    """Detect primary language of text."""
    if not text:
        return "english"
    urdu_chars = set("ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنوہھیےۓ")
    urdu_count = sum(1 for c in text if c in urdu_chars)
    if urdu_count > len(text) * 0.03:
        return "urdu"
    return "english"


# ═════════════════════════════════════════════════════════════════════════════
# CHUNK TYPE CLASSIFIER — 6 CANONICAL TYPES ONLY
# ═════════════════════════════════════════════════════════════════════════════

def classify_chunk_type(text: str) -> str:
    """
    Classify chunk content into one of 6 canonical types:
      program_overview, admission, program_design,
      semester_subjects, course_detail, list_chunk

    IDENTICAL to BS/ADP classification logic — extended with
    MS/PhD-specific signal patterns that map to the SAME 6 types.
    """
    text_lower = text.lower()

    # ── Semester subject list: has "semester" + tabular course listings ──
    # MUST check BEFORE course_detail — semester tables have "Course Code"
    # as a column header which would otherwise match course_detail first.
    if re.search(r'semester\s*[-–—]?\s*[ivx\d]', text_lower) and \
       re.search(r'(sr\.?\s*no|course code|course title|cr\.?\s*hrs?|credit|sn\s)', text_lower):
        return "semester_subjects"

    # ── Course detail: has course code + detailed content markers ──
    # Requires a content-specific marker (outline, CLO, learning outcomes,
    # recommended books, objectives) to distinguish from tabular listings.
    if (re.search(r'course code[:\s]', text_lower) and
        re.search(r'(course outline|course content|specific objective|clo|course description|'
                  r'learning outcomes?|suggested readings?|recommended books?|'
                  r'course objectives?)', text_lower)) or \
       (re.search(r'course title[:\s]', text_lower) and
        re.search(r'(course outline|course content|specific objective|clo)', text_lower)):
        return "course_detail"

    # ── Admission ──
    if re.search(r'admission\s*(require|rule|criteria|eligib|procedure)', text_lower) or \
       (re.search(r'admission', text_lower) and
        re.search(r'(f\.?a|f\.?sc|intermediate|2nd division|cgpa|master|16.?year|gre|hat)', text_lower)):
        return "admission"

    # ── Program design / credit structure / thesis / deficiency ──
    if re.search(r'(program (design|layout|elaboration)|credit (hour|distribution)|'
                 r'categories of courses|course categories|degree requirements?|'
                 r'thesis\s*(requirement|option|alternative|component)|'
                 r'comprehensive\s*(exam|examination)|deficiency\s*course|'
                 r'internship\s*(component|requirement)|teaching\s*practice|'
                 r'total credit|duration of)', text_lower):
        return "program_design"

    # ── Program overview ──
    if re.search(r'(program (objective|mission|vision|introduction|aim|overview|description)|'
                 r'department of|program goal|program purpose|academic honesty|'
                 r'plagiarism policy|study tour|field visit|scheme of studies)', text_lower):
        return "program_overview"

    # ── List chunks: elective, specialization, fee structure, course lists ──
    if re.search(r'(area.?of specialization|elective courses|allied courses|'
                 r'interdisciplinary|optional courses|table\s*[a-c]|'
                 r'list of (elective|specialization|compulsory)|'
                 r'specialization\s*(area|track|option)|'
                 r'fee\s*(structure|amount)|tuition)', text_lower):
        return "list_chunk"

    # ── Default: use content signals ──
    if extract_course_code(text):
        return "course_detail"

    return "program_overview"


def infer_category(text: str) -> str:
    """Infer course category from content."""
    text_lower = text.lower()
    if re.search(r'\bdeficiency\b', text_lower):
        return "deficiency"
    if re.search(r'\belective\b', text_lower):
        return "elective"
    if re.search(r'\bfoundation\b', text_lower):
        return "foundation"
    if re.search(r'\bspecialization\b', text_lower):
        return "specialization"
    if re.search(r'\binternship\b|\bfield experience\b|\bteaching practice\b', text_lower):
        return "internship"
    if re.search(r'\bnon.?credit\b', text_lower):
        return "non_credit"
    if re.search(r'\bmajor\b|\bcore\b|\bdisciplinary\b', text_lower):
        return "major"
    if re.search(r'\bcompulsory\b', text_lower):
        return "compulsory"
    return ""


def extract_specialization(text: str) -> str:
    """Extract specialization track from text (for Special Education etc.)."""
    patterns = [
        r'Specialization[:\s]+([^\n,]+)',
        r'Hearing\s*Impairment',
        r'Visual\s*Impairment',
        r'Mentally\s*Challenged',
        r'Physically\s*Challenged',
        r'Learning\s*Disabilities',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()[:80]
    return ""


# ═════════════════════════════════════════════════════════════════════════════
# BUILD FULL METADATA FOR ONE CHUNK
# ═════════════════════════════════════════════════════════════════════════════

def build_chunk_metadata(
    text: str,
    page_num: int,
    filename: str,
    program_name: str,
    degree_type: str,
    department: str,
    year_revised: int,
) -> Dict[str, Any]:
    """
    Build the canonical metadata dict for a single chunk.
    All null values are stripped (Pinecone rejects them).
    """
    chunk_type = classify_chunk_type(text)
    course_code = extract_course_code(text)
    course_title = extract_course_title(text)
    credit_hours = extract_credit_hours(text)
    all_semesters = extract_all_semesters(text)
    semester = all_semesters[0] if all_semesters else 0
    language = detect_language(text)
    category = infer_category(text)
    specialization = extract_specialization(text)

    meta: Dict[str, Any] = {
        # ── Core identity ──
        "program_name": program_name,
        "degree_type": degree_type,
        "department": department,
        "university": "University of Education, Lahore",
        "chunk_type": chunk_type,

        # ── Source tracking ──
        "source_file": filename,
        "page_number": page_num,

        # ── Content metadata ──
        "language": language,
        "chunk_length": len(text),

        # ── Full text for retrieval ──
        "text": text[:39000],  # Pinecone max metadata = 40KB
    }

    # ── Conditional fields (only add if non-empty) ──
    if year_revised:
        meta["year_revised"] = year_revised
    if course_code:
        meta["course_code"] = course_code
    if course_title:
        meta["course_title"] = course_title
    if credit_hours:
        meta["credit_hours"] = credit_hours
    if semester > 0:
        meta["semester"] = semester
    # Multi-semester support: store min/max for range-based filtering
    if len(all_semesters) > 0:
        meta["semester_min"] = all_semesters[0]
        meta["semester_max"] = all_semesters[-1]
    if len(all_semesters) > 1:
        meta["semesters_covered"] = len(all_semesters)
    if category:
        meta["course_category"] = category
    if specialization:
        meta["specialization"] = specialization

    # ── Boolean flags ──
    meta["has_course_code"] = bool(course_code)
    meta["is_course_outline"] = bool(
        re.search(r'Course (Code|Title|Outline)', text, re.IGNORECASE)
    )

    return meta


# ═════════════════════════════════════════════════════════════════════════════
# CHUNK TEXT WITH METADATA HEADER (for richer embeddings)
# ═════════════════════════════════════════════════════════════════════════════

def construct_embedding_text(text: str, meta: Dict) -> str:
    """
    Prepend a metadata header to the chunk text before embedding.
    This anchors the embedding to the specific program/course,
    reducing cross-program contamination in vector space.
    """
    parts = [
        f"program: {meta.get('program_name', '')}",
        f"degree: {meta.get('degree_type', '')}",
        f"type: {meta.get('chunk_type', '')}",
    ]
    if meta.get("semester"):
        parts.append(f"semester: {meta['semester']}")
    if meta.get("course_code"):
        parts.append(f"course_code: {meta['course_code']}")
    if meta.get("course_title"):
        parts.append(f"course_title: {meta['course_title']}")
    if meta.get("specialization"):
        parts.append(f"specialization: {meta['specialization']}")

    header = " | ".join(parts)
    return f"[{header}]\n\n{text}"


# ═════════════════════════════════════════════════════════════════════════════
# DETERMINISTIC ID GENERATION
# ═════════════════════════════════════════════════════════════════════════════

def generate_vector_id(filename: str, page: int, chunk_idx: int, text: str) -> str:
    """Generate a deterministic, unique vector ID."""
    key = f"msphd::{filename}::p{page}::c{chunk_idx}::{text[:100]}"
    return hashlib.md5(key.encode("utf-8")).hexdigest()[:20]


# ═════════════════════════════════════════════════════════════════════════════
# PROGRESS TRACKER
# ═════════════════════════════════════════════════════════════════════════════

class ProgressTracker:
    def __init__(self):
        self.processed: Set[str] = set()
        self._load()

    def _load(self):
        if PROGRESS_FILE.exists():
            try:
                data = json.loads(PROGRESS_FILE.read_text())
                self.processed = set(data.get("processed", []))
                log.info("Loaded progress: %d files already done", len(self.processed))
            except Exception:
                pass

    def _save(self):
        PROGRESS_FILE.write_text(json.dumps({
            "processed": list(self.processed),
            "last_update": datetime.now().isoformat(),
        }, indent=2))

    def is_done(self, key: str) -> bool:
        return key in self.processed

    def mark_done(self, key: str):
        self.processed.add(key)
        self._save()


# ═════════════════════════════════════════════════════════════════════════════
# CHUNK TYPE VALIDATION
# ═════════════════════════════════════════════════════════════════════════════

VALID_CHUNK_TYPES = {
    "program_overview",
    "admission",
    "program_design",
    "semester_subjects",
    "course_detail",
    "list_chunk",
}


def validate_chunk_type(chunk_type: str) -> str:
    """Enforce that only canonical chunk types are used."""
    if chunk_type not in VALID_CHUNK_TYPES:
        log.warning("⚠️ Invalid chunk_type '%s' → defaulting to 'program_overview'", chunk_type)
        return "program_overview"
    return chunk_type


# ═════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def run_pipeline(dry_run: bool = False, resume: bool = False, single_file: str = ""):
    log.info("=" * 70)
    log.info("CANONICAL MS/PhD PDF INGESTION PIPELINE")
    log.info("=" * 70)
    log.info("Mode:      %s", "DRY RUN" if dry_run else "LIVE INGESTION")
    log.info("Resume:    %s", resume)
    log.info("Source:    %s", DATA_DIR)
    log.info("Target:    %s / %s", PINECONE_INDEX, PINECONE_NS)
    if single_file:
        log.info("Single:    %s", single_file)
    log.info("")

    # ── Validate environment ──
    if not dry_run:
        for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
            if not os.getenv(key):
                raise ValueError(f"❌ {key} not found in environment")
        log.info("✅ API keys verified")

    # ── Discover PDFs ──
    pdf_files = sorted(DATA_DIR.glob("*.pdf")) + sorted(DATA_DIR.glob("*.PDF"))
    # Exclude non-PDF files
    exclude = {"MSC and PHD.txt", "ms-phd-departments-details.json"}
    pdf_files = [f for f in pdf_files if f.name not in exclude]

    if single_file:
        pdf_files = [f for f in pdf_files if f.name == single_file]
        if not pdf_files:
            log.error("❌ File not found: %s", single_file)
            return

    log.info("📄 Found %d PDF files\n", len(pdf_files))

    if not pdf_files:
        log.error("No PDFs found in %s", DATA_DIR)
        return

    # ── Init progress tracker ──
    progress = ProgressTracker() if resume else None

    # ── Init chunker ──
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=SEPARATORS,
        is_separator_regex=False,
    )

    # ── Process all PDFs ──
    all_vectors = []   # (id, embedding_text, metadata)
    stats = defaultdict(int)
    type_counts = defaultdict(int)
    file_chunk_counts = {}

    for pdf_file in pdf_files:
        fname = pdf_file.name

        # Skip if already done
        if progress and progress.is_done(fname):
            log.info("⏭️  Skipping (already processed): %s", fname)
            stats["skipped"] += 1
            continue

        log.info("📖 Processing: %s", fname)

        # ── Resolve file-level metadata from map ──
        program_name, degree_type, department, year_revised = resolve_file_metadata(fname)
        log.info("  → Program: %s | Degree: %s | Dept: %s | Year: %d",
                 program_name, degree_type, department, year_revised)

        try:
            # Load PDF
            loader = PyPDFLoader(str(pdf_file))
            pages = loader.load()

            if not pages:
                log.warning("  ⚠️  No pages extracted from %s", fname)
                stats["empty_files"] += 1
                continue

            # Chunk
            chunks = splitter.split_documents(pages)

            # Filter by quality
            quality_chunks = []
            for chunk in chunks:
                text = chunk.page_content.strip()
                if len(text) < MIN_CHUNK_SIZE:
                    stats["too_small"] += 1
                    continue
                if len(text) > MAX_CHUNK_SIZE:
                    text = text[:MAX_CHUNK_SIZE]
                quality_chunks.append((text, chunk.metadata.get("page", 0) + 1))

            log.info("  Pages: %d | Raw chunks: %d | Quality chunks: %d",
                     len(pages), len(chunks), len(quality_chunks))

            file_chunk_count = 0
            for idx, (text, page_num) in enumerate(quality_chunks):
                # Build metadata
                meta = build_chunk_metadata(
                    text=text,
                    page_num=page_num,
                    filename=fname,
                    program_name=program_name,
                    degree_type=degree_type,
                    department=department,
                    year_revised=year_revised,
                )

                # Validate chunk_type is canonical
                meta["chunk_type"] = validate_chunk_type(meta["chunk_type"])

                # Build embedding text
                embed_text = construct_embedding_text(text, meta)

                # Generate ID
                vec_id = generate_vector_id(fname, page_num, idx, text)

                all_vectors.append((vec_id, embed_text, meta))
                type_counts[meta["chunk_type"]] += 1
                file_chunk_count += 1

            file_chunk_counts[fname] = file_chunk_count
            stats["files_processed"] += 1
            stats["total_chunks"] += file_chunk_count

            if progress:
                progress.mark_done(fname)

        except Exception as e:
            log.error("  ❌ Failed: %s — %s", fname, str(e)[:200])
            stats["failed"] += 1
            continue

    # ── Report ──
    log.info("")
    log.info("=" * 70)
    log.info("EXTRACTION REPORT")
    log.info("=" * 70)
    log.info("PDF files found:      %d", len(pdf_files))
    log.info("Files processed:      %d", stats["files_processed"])
    log.info("Files skipped:        %d", stats.get("skipped", 0))
    log.info("Files failed:         %d", stats.get("failed", 0))
    log.info("Empty files:          %d", stats.get("empty_files", 0))
    log.info("Chunks too small:     %d", stats.get("too_small", 0))
    log.info("Total quality chunks: %d", stats["total_chunks"])
    log.info("")
    log.info("Chunks by type (CANONICAL — only 6 allowed):")
    for ct in sorted(type_counts.keys()):
        marker = "✅" if ct in VALID_CHUNK_TYPES else "❌"
        log.info("  %s %-25s: %d", marker, ct, type_counts[ct])

    # ── Validate no invalid chunk types leaked through ──
    invalid_types = set(type_counts.keys()) - VALID_CHUNK_TYPES
    if invalid_types:
        log.error("❌ INVALID CHUNK TYPES DETECTED: %s", invalid_types)
        log.error("   This is a critical error. Aborting before upsert.")
        return

    log.info("")
    log.info("Top 15 files by chunk count:")
    sorted_files = sorted(file_chunk_counts.items(), key=lambda x: -x[1])
    for fname, count in sorted_files[:15]:
        log.info("  %-60s: %d", fname, count)

    if dry_run:
        log.info("")
        log.info("DRY RUN complete. No embeddings or upserts performed.")

        # Dump sample chunks for inspection
        if all_vectors:
            sample_file = _backend_dir / "Data_Ingestion" / "ms_phd_dry_run_sample.json"
            sample_data = []
            for vec_id, embed_text, meta in all_vectors[:20]:
                sample_entry = {
                    "id": vec_id,
                    "metadata": {k: v for k, v in meta.items() if k != "text"},
                    "text_preview": meta.get("text", "")[:300],
                }
                sample_data.append(sample_entry)
            sample_file.write_text(json.dumps(sample_data, indent=2))
            log.info("📝 Saved %d sample chunks to %s", len(sample_data), sample_file)

        return

    # ── Embed + Upsert ──
    if not all_vectors:
        log.warning("No vectors to upsert!")
        return

    log.info("")
    log.info("=" * 70)
    log.info("EMBEDDING & UPSERTING (%d vectors)", len(all_vectors))
    log.info("=" * 70)

    from openai import OpenAI
    from pinecone import Pinecone

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index = pc.Index(PINECONE_INDEX)

    # ── Step 1: Embed ──
    embed_texts = [v[1] for v in all_vectors]
    all_embeddings = []

    log.info("Embedding %d texts in batches of %d...", len(embed_texts), EMBED_BATCH)
    for i in range(0, len(embed_texts), EMBED_BATCH):
        batch = embed_texts[i:i + EMBED_BATCH]
        for attempt in range(1, 6):
            try:
                resp = openai_client.embeddings.create(
                    model=OPENAI_MODEL,
                    input=batch,
                    dimensions=PINECONE_DIM,
                )
                all_embeddings.extend([item.embedding for item in resp.data])
                batch_num = i // EMBED_BATCH + 1
                total_batches = (len(embed_texts) + EMBED_BATCH - 1) // EMBED_BATCH
                log.info("  Embedded batch %d/%d (%d texts)", batch_num, total_batches, len(batch))
                break
            except Exception as e:
                wait = min(2 ** attempt, 30)
                log.warning("  Embed error (attempt %d): %s — retrying in %ds",
                            attempt, str(e)[:80], wait)
                time.sleep(wait)
                if attempt >= 5:
                    raise

    # ── Step 2: Upsert ──
    log.info("Upserting %d vectors to '%s'...", len(all_embeddings), PINECONE_NS)

    vectors_to_upsert = []
    for (vec_id, _, meta), embedding in zip(all_vectors, all_embeddings):
        vectors_to_upsert.append({
            "id": vec_id,
            "values": embedding,
            "metadata": meta,
        })

    upserted = 0
    for i in range(0, len(vectors_to_upsert), UPSERT_BATCH):
        batch = vectors_to_upsert[i:i + UPSERT_BATCH]
        for attempt in range(1, 4):
            try:
                index.upsert(vectors=batch, namespace=PINECONE_NS)
                upserted += len(batch)
                batch_num = i // UPSERT_BATCH + 1
                total_batches = (len(vectors_to_upsert) + UPSERT_BATCH - 1) // UPSERT_BATCH
                log.info("  Upserted batch %d/%d (%d vectors)", batch_num, total_batches, len(batch))
                break
            except Exception as e:
                wait = min(2 ** attempt, 15)
                log.warning("  Upsert error (attempt %d): %s — retrying in %ds",
                            attempt, str(e)[:120], wait)
                time.sleep(wait)
                if attempt >= 3:
                    log.error("  FAILED batch at index %d", i)
                    raise

    # ── Final stats ──
    log.info("")
    log.info("=" * 70)
    log.info("✅ PIPELINE COMPLETE")
    log.info("=" * 70)
    log.info("Embedded:   %d", len(all_embeddings))
    log.info("Upserted:   %d", upserted)
    log.info("Namespace:  %s", PINECONE_NS)

    # Verify
    time.sleep(3)
    try:
        idx_stats = index.describe_index_stats()
        ns_data = idx_stats.get("namespaces", {}).get(PINECONE_NS, {})
        log.info("Pinecone vectors in '%s': %s", PINECONE_NS, ns_data.get("vector_count", "?"))
    except Exception:
        pass

    log.info("=" * 70)


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Canonical MS/PhD PDF Ingestion Pipeline"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate only — no embedding/upserting")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already processed files")
    parser.add_argument("--single-file", type=str, default="",
                        help="Process a single PDF file (by filename)")

    args = parser.parse_args()
    run_pipeline(dry_run=args.dry_run, resume=args.resume, single_file=args.single_file)
