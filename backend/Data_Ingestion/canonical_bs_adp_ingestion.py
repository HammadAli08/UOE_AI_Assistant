"""
canonical_bs_adp_ingestion.py
=============================================================================
Production-grade PDF ingestion pipeline for BS & ADP Scheme of Studies.

SOURCE:  68 PDF files in Data/BS&ADP/
TARGET:  Pinecone index `uoeaiassistant`, namespace `bs-adp-schemes`
EMBED:   OpenAI text-embedding-3-large (dim=3072)

ARCHITECTURE:
  1. Load each PDF via PyPDFLoader
  2. Apply course-boundary-aware semantic chunking
  3. Extract rich metadata per chunk (program, degree, semester, course, etc.)
  4. Normalize chunk_type to 6 canonical types
  5. Construct embedding text with metadata header
  6. Generate deterministic vector IDs
  7. Strip null metadata values (Pinecone rejects null)
  8. Embed in batches via OpenAI
  9. Upsert in batches to Pinecone

USAGE:
    python canonical_bs_adp_ingestion.py               # Full ingestion
    python canonical_bs_adp_ingestion.py --dry-run      # Parse + validate only
    python canonical_bs_adp_ingestion.py --resume       # Skip already processed
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
PINECONE_NS      = "bs-adp-schemes"
PINECONE_DIM     = 3072

OPENAI_MODEL     = "text-embedding-3-large"
EMBED_BATCH      = 20        # texts per OpenAI call
UPSERT_BATCH     = 100       # vectors per Pinecone upsert

DATA_DIR = Path(
    "/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT"
    "/backend/Data/BS&ADP"
)

LOG_FILE = _backend_dir / "Data_Ingestion" / "canonical_ingestion.log"
PROGRESS_FILE = _backend_dir / "Data_Ingestion" / "ingestion_progress.json"

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
# METADATA EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════

# ── Program name inference from filename ──

FILENAME_TO_PROGRAM = {
    # Maps filename substrings → (program_name, degree_type)
    # This is exhaustive for all 68 PDFs
}


def infer_program_name(filename: str) -> str:
    """Infer human-readable program name from PDF filename."""
    name = filename.replace(".pdf", "").replace(".PDF", "")

    # Remove leading numbers like "2-" or "11-"
    name = re.sub(r'^\d+-\s*', '', name)

    # Remove year in parens: (2023), (2024), etc.
    name = re.sub(r'\s*\(\d{4}\)', '', name)

    # Remove revision notes: (Revised in 2024)
    name = re.sub(r'\s*\(Revised in \d{4}\)', '', name)

    # Clean up extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()

    return name


def infer_degree_type(filename: str, program_name: str) -> str:
    """Infer degree type from filename."""
    fn = filename.upper()
    pn = program_name.upper()
    combined = fn + " " + pn

    if "POST ADP" in combined:
        return "BS (Post ADP)"
    if "ADP " in combined or "ASSOCIATE DEGREE" in combined or combined.startswith("AD "):
        return "ADP"
    if "BBA" in combined:
        return "BBA"
    if "BFA" in combined:
        return "BFA"
    if "B.ED" in combined or "BACHELOR OF EDUCATION" in combined:
        return "B.Ed."
    if "BS " in combined or "BACHELOR OF S" in combined:
        return "BS"
    return "BS"


def infer_department(filename: str) -> str:
    """Infer department from filename."""
    dept_map = {
        'Computer Science': ['computer science', 'bs cs', 'adp cs', 'bs_cs', 'adp_cs'],
        'Artificial Intelligence': ['artificial intelligence'],
        'Information Technology': ['information technology'],
        'Information Management': ['information management'],
        'Mathematics': ['math'],
        'Physics': ['physics'],
        'Chemistry': ['chemistry'],
        'History': ['history'],
        'English': ['english'],
        'Urdu': ['urdu'],
        'Education': ['education', 'b.ed'],
        'Special Education': ['special education'],
        'Economics': ['economics'],
        'Economics and Finance': ['economics and finance'],
        'Business Administration': ['business admin', 'bba'],
        'Business Analytics': ['business analytics'],
        'Public Administration': ['public admin'],
        'Islamic Studies': ['islamic'],
        'Pakistan Studies': ['pakistan studies'],
        'Archaeology': ['archaeology'],
        'Fine Arts': ['fine arts', 'bfa'],
        'Painting': ['painting'],
        'Graphic Design': ['graphic design'],
        'Physical Education': ['physical education', 'sports'],
        'Botany': ['botany'],
        'Zoology': ['zoology'],
    }
    fn_lower = filename.lower()
    for dept, keywords in dept_map.items():
        if any(kw in fn_lower for kw in keywords):
            return dept
    return "General"


def extract_year(filename: str) -> str:
    """Extract academic year from filename."""
    # Find the LAST year in parens (the primary year)
    matches = re.findall(r'\((\d{4})\)', filename)
    if matches:
        return matches[0]
    match = re.search(r'20\d{2}', filename)
    if match:
        return match.group(0)
    return ""


# ── Content-level metadata extraction ──

ROMAN_MAP = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4,
    'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8,
    'IX': 9, 'X': 10, 'XI': 11, 'XII': 12,
}


def extract_course_code(text: str) -> str:
    """Extract course code like COMP1112, HIST3111."""
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
            # Clean up artifacts
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
    """Extract semester number (0 if not found)."""
    patterns = [
        r'Semester\s*[-–—]?\s*([IVX]+)',
        r'Semester\s*[-–—]?\s*(\d{1,2})',
        r'(\d)(?:st|nd|rd|th)\s+Semester',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            val = m.group(1).upper().strip()
            if val in ROMAN_MAP:
                return ROMAN_MAP[val]
            try:
                n = int(val)
                if 1 <= n <= 12:
                    return n
            except ValueError:
                pass
    return 0


def detect_language(text: str) -> str:
    """Detect primary language of text."""
    if not text:
        return "english"
    urdu_chars = set("ابپتٹثجچحخدڈذرڑزژسشصضطظعغفقکگلمنوہھیےۓ")
    urdu_count = sum(1 for c in text if c in urdu_chars)
    if urdu_count > len(text) * 0.03:
        return "urdu"
    return "english"


def classify_chunk_type(text: str) -> str:
    """
    Classify chunk content into one of 6 canonical types:
      program_overview, admission, program_design,
      semester_subjects, course_detail, list_chunk
    """
    text_lower = text.lower()

    # Course detail: has course code + title/outline
    if re.search(r'course code[:\s]', text_lower) or \
       (re.search(r'course title[:\s]', text_lower) and
        re.search(r'(course outline|course content|specific objective|clo)', text_lower)):
        return "course_detail"

    # Semester subject list: has "semester" + tabular course listings
    if re.search(r'semester\s*[-–]?\s*[ivx\d]', text_lower) and \
       re.search(r'(sr\.?\s*no|course code|course title)', text_lower):
        return "semester_subjects"

    # Admission
    if re.search(r'admission\s*(requirement|rule|criteria|eligib)', text_lower) or \
       (re.search(r'admission', text_lower) and re.search(r'(f\.?a|f\.?sc|intermediate|2nd division|cgpa)', text_lower)):
        return "admission"

    # Program design / credit structure
    if re.search(r'(program (design|layout|elaboration)|credit (hour|distribution)|categories of courses)', text_lower):
        return "program_design"

    # Program overview
    if re.search(r'(program (objective|mission|vision|introduction|aim)|department of)', text_lower):
        return "program_overview"

    # List chunks (specialization, elective, allied lists)
    if re.search(r'(area.?of specialization|elective courses|allied courses|interdisciplinary)', text_lower):
        return "list_chunk"

    # Default: use content signals
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
    if re.search(r'\bcapstone\b', text_lower):
        return "capstone"
    if re.search(r'\binternship\b|\bfield experience\b', text_lower):
        return "internship"
    if re.search(r'\bnon.?credit\b', text_lower):
        return "non_credit"
    if re.search(r'\bgeneral education\b|\bgec\b', text_lower):
        return "general_education"
    if re.search(r'\bminor\b', text_lower):
        return "minor"
    if re.search(r'\ballied\b|\binterdisciplinary\b', text_lower):
        return "allied"
    if re.search(r'\bmajor\b|\bcore\b|\bdisciplinary\b', text_lower):
        return "major"
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
    academic_year: str,
) -> Dict[str, Any]:
    """
    Build the canonical metadata dict for a single chunk.
    All null values are stripped (Pinecone rejects them).
    """
    chunk_type = classify_chunk_type(text)
    course_code = extract_course_code(text)
    course_title = extract_course_title(text)
    credit_hours = extract_credit_hours(text)
    semester = extract_semester(text)
    language = detect_language(text)
    category = infer_category(text)

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
    if academic_year:
        meta["academic_year"] = academic_year
    if course_code:
        meta["course_code"] = course_code
    if course_title:
        meta["course_title"] = course_title
    if credit_hours:
        meta["credit_hours"] = credit_hours
    if semester > 0:
        meta["semester"] = semester
    if category:
        meta["category"] = category

    # ── Boolean flags ──
    meta["has_course_code"] = bool(course_code)
    meta["is_course_outline"] = bool(
        re.search(r'Course (Code|Title|Outline)', text, re.IGNORECASE)
    )
    meta["mentions_lab"] = bool(
        re.search(r'\blab\b|\blaboratory\b|\bpractical\b', text, re.IGNORECASE)
    )
    meta["is_elective"] = "elective" in text.lower()

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

    header = " | ".join(parts)
    return f"[{header}]\n\n{text}"


# ═════════════════════════════════════════════════════════════════════════════
# DETERMINISTIC ID GENERATION
# ═════════════════════════════════════════════════════════════════════════════

def generate_vector_id(filename: str, page: int, chunk_idx: int, text: str) -> str:
    """Generate a deterministic, unique vector ID."""
    key = f"{filename}::p{page}::c{chunk_idx}::{text[:100]}"
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
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def run_pipeline(dry_run: bool = False, resume: bool = False):
    log.info("=" * 70)
    log.info("CANONICAL BS & ADP PDF INGESTION PIPELINE")
    log.info("=" * 70)
    log.info("Mode:      %s", "DRY RUN" if dry_run else "LIVE INGESTION")
    log.info("Resume:    %s", resume)
    log.info("Source:    %s", DATA_DIR)
    log.info("Target:    %s / %s", PINECONE_INDEX, PINECONE_NS)
    log.info("")

    # ── Validate environment ──
    if not dry_run:
        for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
            if not os.getenv(key):
                raise ValueError(f"❌ {key} not found in environment")
        log.info("✅ API keys verified")

    # ── Discover PDFs ──
    pdf_files = sorted(DATA_DIR.glob("*.pdf")) + sorted(DATA_DIR.glob("*.PDF"))
    # Exclude non-scheme files
    exclude = {"fee_structure.pdf", "bs-adp-departments-details.json"}
    pdf_files = [f for f in pdf_files if f.name not in exclude]
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

        # ── Infer file-level metadata ──
        program_name = infer_program_name(fname)
        degree_type = infer_degree_type(fname, program_name)
        department = infer_department(fname)
        academic_year = extract_year(fname)

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
                    academic_year=academic_year,
                )

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
    log.info("Chunks by type:")
    for ct in sorted(type_counts.keys()):
        log.info("  %-25s: %d", ct, type_counts[ct])

    log.info("")
    log.info("Top 15 files by chunk count:")
    sorted_files = sorted(file_chunk_counts.items(), key=lambda x: -x[1])
    for fname, count in sorted_files[:15]:
        log.info("  %-60s: %d", fname, count)

    if dry_run:
        log.info("")
        log.info("DRY RUN complete. No embeddings or upserts performed.")
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
        description="Canonical BS & ADP PDF Ingestion Pipeline"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate only — no embedding/upserting")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already processed files")

    args = parser.parse_args()
    run_pipeline(dry_run=args.dry_run, resume=args.resume)
