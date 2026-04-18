"""
rules_regulations_ingestion.py
=============================================================================
Production-grade PDF ingestion pipeline for University Rules & Regulations.

SOURCE:  21 PDF files in Data/Rules/
TARGET:  Pinecone index `uoeaiassistant`, namespace `rules-regulations`
EMBED:   OpenAI text-embedding-3-large (dim=3072)

ARCHITECTURE:
  1. Load each PDF via PyPDFLoader
  2. Apply regulation-boundary-aware semantic chunking
  3. Extract rich metadata per chunk (doc_type, topic_cluster, scope, year, etc.)
  4. Construct embedding text with metadata header for grounding
  5. Generate deterministic vector IDs
  6. Strip null metadata values (Pinecone rejects null)
  7. Embed in batches via OpenAI
  8. Upsert in batches to Pinecone

DESIGN: No metadata filtering at query time — pure semantic search.
Metadata is embedded into chunk text for semantic grounding only.

USAGE:
    python rules_regulations_ingestion.py               # Full ingestion
    python rules_regulations_ingestion.py --dry-run      # Parse + validate only
    python rules_regulations_ingestion.py --resume       # Skip already processed
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
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from collections import defaultdict

from dotenv import load_dotenv

# ─── Load .env ───────────────────────────────────────────────────────────────
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PINECONE_INDEX   = "uoeaiassistant"
PINECONE_NS      = "rules-regulations"
PINECONE_DIM     = 3072

OPENAI_MODEL     = "text-embedding-3-large"
EMBED_BATCH      = 20        # texts per OpenAI call
UPSERT_BATCH     = 100       # vectors per Pinecone upsert

DATA_DIR = _backend_dir / "Data" / "Rules"

LOG_FILE      = Path(__file__).resolve().parent / "rules_regulations_ingestion.log"
PROGRESS_FILE = Path(__file__).resolve().parent / "rules_regulations_progress.json"

# Chunk sizing — regulation documents need slightly larger chunks to preserve
# context around numbered clauses and cross-referenced sections
CHUNK_SIZE     = 1200
CHUNK_OVERLAP  = 200
MIN_CHUNK_SIZE = 80
MAX_CHUNK_SIZE = 3000

# Regulation-boundary-aware separators (highest priority first)
SEPARATORS = [
    "\n\n## ",           # Markdown-style headers (if any)
    "\n### ",
    "\nChapter ",        # Chapter boundaries
    "\nPART ",           # Part boundaries
    "\nSection ",        # Section boundaries
    "\nRegulation ",     # Regulation numbered sections
    "\nArticle ",        # Article boundaries
    "\nRule ",           # Rule boundaries
    "\nClause ",         # Clause boundaries
    "\n2.",              # Top-level numbered sections (common in UE docs)
    "\n3.",
    "\n4.",
    "\n5.",
    "\n6.",
    "\n7.",
    "\n8.",
    "\n9.",
    "\n10.",
    "\n11.",
    "\n12.",
    "\n13.",
    "\n14.",
    "\n15.",
    "\nSchedule ",       # Schedules / Annexures
    "\nAnnexure ",
    "\n\n",              # Double newline
    "\n",               # Single newline
    ". ",               # Sentence boundary
]


# ═════════════════════════════════════════════════════════════════════════════
# DOCUMENT IDENTIFICATION MAP
# ═════════════════════════════════════════════════════════════════════════════

# Maps filename patterns to rich metadata. Used to tag each PDF's chunks
# with correct doc_type, topic_cluster, regulation_scope, and effective_year.

DOCUMENT_MAP: Dict[str, Dict[str, str]] = {
    "1-Definitions": {
        "source_doc_id": "def_2022",
        "doc_type": "Regulation",
        "topic_cluster": "General",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "General Regulations 2022": {
        "source_doc_id": "gen_reg_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Examinations, Courses, Degrees",
        "regulations_scope": "Undergraduate, Graduate, Postgraduate",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "3-Admission & Examination Regulations 2022 regarding Associate": {
        "source_doc_id": "admission_ug_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Grading, Probation, Degree Requirements",
        "regulations_scope": "Associate, Bachelor, Master",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "Admission & Examination Regulations 2022 for MS-MPhil-MBA": {
        "source_doc_id": "admission_graduate_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Grading, Probation, Thesis",
        "regulations_scope": "MS, MPhil, MBA",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "Admission & Examination Regulations 2022 for PhD": {
        "source_doc_id": "admission_phd_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Grading, Probation, Comprehensive Exam, Thesis",
        "regulations_scope": "PhD",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "Admission & Examination Regulations 2023 for PhD": {
        "source_doc_id": "admission_phd_2023",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Probation, Comprehensive Exam, Thesis",
        "regulations_scope": "PhD",
        "effective_year": "2023",
        "authority": "Syndicate",
    },
    "Annexure - B - Admission & Examination Regulations 2023 for MS-MPhil-MBA": {
        "source_doc_id": "admission_graduate_2023",
        "doc_type": "Regulation",
        "topic_cluster": "Admissions, Probation, Thesis",
        "regulations_scope": "MS, MPhil, MBA",
        "effective_year": "2023",
        "authority": "Syndicate",
    },
    "6-Freezing": {
        "source_doc_id": "freezing_reg_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Freezing",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "7-Unfair Means": {
        "source_doc_id": "unfair_means_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Examinations, Unfair Means",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "8-Migration": {
        "source_doc_id": "migration_reg_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Migration",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "9-Payment and Refund": {
        "source_doc_id": "fee_payment_refund_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Fee",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "10-Regulations relating to Discipline": {
        "source_doc_id": "discipline_conduct_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Discipline",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "11-Hostel": {
        "source_doc_id": "hostel_reg_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Hostel",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "12-Regulations 2022 regarding Constitution of Examination Centre": {
        "source_doc_id": "exam_centre_reg_2022",
        "doc_type": "Regulation",
        "topic_cluster": "Examinations",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Syndicate",
    },
    "Hand Book 2022": {
        "source_doc_id": "student_handbook_2022",
        "doc_type": "Handbook",
        "topic_cluster": "General, Regulations, Facilities, Policies",
        "regulations_scope": "All",
        "effective_year": "2022",
        "authority": "Vice Chancellor",
    },
    "fee_structure": {
        "source_doc_id": "fee_structure_2023",
        "doc_type": "Fee Structure",
        "topic_cluster": "Fee",
        "regulations_scope": "All",
        "effective_year": "2023",
        "authority": "Syndicate",
    },
    "Rules and Regulations of UE Libraries": {
        "source_doc_id": "library_rules_2021",
        "doc_type": "Regulation",
        "topic_cluster": "Library",
        "regulations_scope": "All",
        "effective_year": "2021",
        "authority": "Vice Chancellor",
    },
    "Financial Assistance": {
        "source_doc_id": "financial_assistance",
        "doc_type": "Policy",
        "topic_cluster": "Scholarship, Financial Aid",
        "regulations_scope": "Undergraduate, Graduate",
        "effective_year": "",
        "authority": "Vice Chancellor",
    },
    "Teacher": {
        "source_doc_id": "teacher_handbook_2023",
        "doc_type": "Handbook",
        "topic_cluster": "Faculty",
        "regulations_scope": "Faculty",
        "effective_year": "2023",
        "authority": "Vice Chancellor",
    },
    "Dr. Muhammad Anwar": {
        "source_doc_id": "dr_muhammad_anwar",
        "doc_type": "Faculty Profile",
        "topic_cluster": "Faculty Profile",
        "regulations_scope": "",
        "effective_year": "",
        "authority": "",
    },
    "Usman Rafi": {
        "source_doc_id": "usman_rafi",
        "doc_type": "Faculty Profile",
        "topic_cluster": "Faculty Profile",
        "regulations_scope": "",
        "effective_year": "",
        "authority": "",
    },
}


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

def identify_document(filename: str) -> Dict[str, str]:
    """
    Match a filename to its entry in DOCUMENT_MAP.
    Returns the metadata dict for the matched document.
    """
    for pattern, meta in DOCUMENT_MAP.items():
        if pattern.lower() in filename.lower():
            return dict(meta)  # copy

    # Fallback for unmatched files
    log.warning("  ⚠️  No DOCUMENT_MAP match for: %s — using fallback metadata", filename)
    return {
        "source_doc_id": hashlib.md5(filename.encode()).hexdigest()[:12],
        "doc_type": "Unknown",
        "topic_cluster": "Unknown",
        "regulations_scope": "Unknown",
        "effective_year": _extract_year_from_name(filename),
        "authority": "",
    }


def _extract_year_from_name(filename: str) -> str:
    """Extract 4-digit year from filename."""
    match = re.search(r"(20\d{2})", filename)
    return match.group(1) if match else ""


def build_chunk_metadata(
    text: str,
    page_num: int,
    filename: str,
    chunk_index: int,
    doc_meta: Dict[str, str],
) -> Dict[str, Any]:
    """
    Build complete metadata dict for a single chunk.
    All values are non-None strings/ints (Pinecone rejects None).
    """
    meta = {
        # ── Identity ──
        "source_doc_id":     doc_meta.get("source_doc_id", ""),
        "chunk_id":          "",  # filled below
        "file_name":         filename,
        "page_number":       page_num,

        # ── Document classification ──
        "doc_type":          doc_meta.get("doc_type", ""),
        "topic_cluster":     doc_meta.get("topic_cluster", ""),
        "regulations_scope": doc_meta.get("regulations_scope", ""),
        "effective_year":    doc_meta.get("effective_year", ""),
        "authority":         doc_meta.get("authority", ""),

        # ── Content ──
        "text":              text[:38_000],  # Pinecone 40KB metadata limit
        "text_preview":      text[:200].strip(),
        "chunk_length":      len(text),

        # ── Namespace ──
        "namespace":         PINECONE_NS,
        "source_file":       filename,

        # ── Timestamp ──
        "ingested_at":       datetime.now().isoformat(),
    }

    # Generate deterministic chunk ID
    meta["chunk_id"] = _generate_chunk_id(filename, page_num, chunk_index, text)

    # Strip any None values — Pinecone rejects them
    return {k: v for k, v in meta.items() if v is not None}


def _generate_chunk_id(filename: str, page: int, idx: int, text: str) -> str:
    """Deterministic ID: md5(filename + page + index + content_hash)."""
    content_hash = hashlib.md5(text[:300].encode("utf-8")).hexdigest()[:8]
    raw = f"{filename}|p{page}|c{idx}|{content_hash}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def construct_embedding_text(text: str, meta: Dict[str, Any]) -> str:
    """
    Prepend a metadata header to the chunk text before embedding.
    This anchors the embedding in the correct regulatory context,
    improving retrieval precision without requiring metadata filters.
    """
    header_parts = []

    doc_type = meta.get("doc_type", "")
    if doc_type:
        header_parts.append(f"document_type: {doc_type}")

    topic = meta.get("topic_cluster", "")
    if topic:
        header_parts.append(f"topic: {topic}")

    scope = meta.get("regulations_scope", "")
    if scope:
        header_parts.append(f"applies_to: {scope}")

    year = meta.get("effective_year", "")
    if year:
        header_parts.append(f"effective_year: {year}")

    authority = meta.get("authority", "")
    if authority:
        header_parts.append(f"authority: {authority}")

    fname = meta.get("file_name", "")
    if fname:
        header_parts.append(f"source: {fname}")

    header = "\n".join(header_parts)
    return f"{header}\n\n{text}" if header else text


# ═════════════════════════════════════════════════════════════════════════════
# PROGRESS TRACKING
# ═════════════════════════════════════════════════════════════════════════════

class ProgressTracker:
    """Track which files have been successfully processed."""

    def __init__(self, path: Path):
        self._path = path
        self._data: Dict[str, Any] = {"completed_files": []}
        if path.exists():
            with open(path, "r") as f:
                self._data = json.load(f)

    def is_done(self, filename: str) -> bool:
        return filename in self._data.get("completed_files", [])

    def mark_done(self, filename: str):
        if filename not in self._data["completed_files"]:
            self._data["completed_files"].append(filename)
            self._save()

    def _save(self):
        with open(self._path, "w") as f:
            json.dump(self._data, f, indent=2)


# ═════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def run_pipeline(dry_run: bool = False, resume: bool = False):
    """Execute the full ingestion pipeline."""

    log.info("")
    log.info("=" * 70)
    log.info("  RULES & REGULATIONS PDF INGESTION PIPELINE")
    log.info("=" * 70)
    log.info("  Mode:      %s", "DRY RUN" if dry_run else "LIVE INGESTION")
    log.info("  Resume:    %s", resume)
    log.info("  Source:    %s", DATA_DIR)
    log.info("  Target:    %s / %s", PINECONE_INDEX, PINECONE_NS)
    log.info("")

    # ── Validate env vars ─────────────────────────────────────────────────────
    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")
    log.info("  ✅ API keys verified")

    # ── Discover PDFs ─────────────────────────────────────────────────────────
    pdf_files = sorted(DATA_DIR.glob("*.pdf"))
    log.info("  📄 Found %d PDF files", len(pdf_files))

    if not pdf_files:
        log.error("  No PDF files found in %s", DATA_DIR)
        return

    # ── Progress tracker ──────────────────────────────────────────────────────
    progress = ProgressTracker(PROGRESS_FILE) if resume else None

    # ── Setup chunker ─────────────────────────────────────────────────────────
    from langchain_community.document_loaders import PyPDFLoader
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        from langchain.text_splitter import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=SEPARATORS,
        length_function=len,
        is_separator_regex=False,
    )

    # ── Process all PDFs ──────────────────────────────────────────────────────
    all_vectors: List[Tuple[str, str, Dict]] = []  # (id, embedding_text, metadata)
    stats = defaultdict(int)
    topic_counts = defaultdict(int)
    file_chunk_counts = {}

    for pdf_file in pdf_files:
        fname = pdf_file.name

        # Skip if already done
        if progress and progress.is_done(fname):
            log.info("  ⏭️  Skipping (already processed): %s", fname)
            stats["skipped"] += 1
            continue

        log.info("  📖 Processing: %s", fname)

        # ── Identify document ──
        doc_meta = identify_document(fname)
        log.info("     doc_id=%s  topic=%s  scope=%s  year=%s",
                 doc_meta.get("source_doc_id", "?"),
                 doc_meta.get("topic_cluster", "?"),
                 doc_meta.get("regulations_scope", "?"),
                 doc_meta.get("effective_year", "?"))

        try:
            # Load PDF
            loader = PyPDFLoader(str(pdf_file))
            pages = loader.load()

            if not pages:
                log.warning("     ⚠️  No pages extracted from %s", fname)
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

            log.info("     Pages: %d | Raw chunks: %d | Quality chunks: %d",
                     len(pages), len(chunks), len(quality_chunks))

            file_chunk_count = 0
            for idx, (text, page_num) in enumerate(quality_chunks):
                # Build metadata
                meta = build_chunk_metadata(
                    text=text,
                    page_num=page_num,
                    filename=fname,
                    chunk_index=idx,
                    doc_meta=doc_meta,
                )

                # Build embedding text (with metadata header for grounding)
                embed_text = construct_embedding_text(text, meta)

                # Use chunk_id as vector ID
                vec_id = meta["chunk_id"]

                all_vectors.append((vec_id, embed_text, meta))
                topic_counts[doc_meta.get("topic_cluster", "Unknown")] += 1
                file_chunk_count += 1

            file_chunk_counts[fname] = file_chunk_count
            stats["files_processed"] += 1
            stats["total_chunks"] += file_chunk_count

            if progress:
                progress.mark_done(fname)

        except Exception as e:
            log.error("     ❌ Failed: %s — %s", fname, str(e)[:200])
            stats["failed"] += 1
            continue

    # ── Extraction Report ─────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 70)
    log.info("  EXTRACTION REPORT")
    log.info("=" * 70)
    log.info("  PDF files found:      %d", len(pdf_files))
    log.info("  Files processed:      %d", stats["files_processed"])
    log.info("  Files skipped:        %d", stats.get("skipped", 0))
    log.info("  Files failed:         %d", stats.get("failed", 0))
    log.info("  Empty files:          %d", stats.get("empty_files", 0))
    log.info("  Chunks too small:     %d", stats.get("too_small", 0))
    log.info("  Total quality chunks: %d", stats["total_chunks"])
    log.info("")
    log.info("  Chunks by topic cluster:")
    for tc in sorted(topic_counts.keys()):
        log.info("    %-50s: %d", tc, topic_counts[tc])

    log.info("")
    log.info("  Per-file chunk counts:")
    sorted_files = sorted(file_chunk_counts.items(), key=lambda x: -x[1])
    for fname, count in sorted_files:
        log.info("    %-75s: %d", fname, count)

    if dry_run:
        log.info("")
        log.info("  DRY RUN complete. No embeddings or upserts performed.")
        return

    # ── Embed + Upsert ────────────────────────────────────────────────────────
    if not all_vectors:
        log.warning("  No vectors to upsert!")
        return

    log.info("")
    log.info("=" * 70)
    log.info("  EMBEDDING & UPSERTING (%d vectors)", len(all_vectors))
    log.info("=" * 70)

    from openai import OpenAI
    from pinecone import Pinecone

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index = pc.Index(PINECONE_INDEX)

    # ── Step 1: Embed ──
    embed_texts = [v[1] for v in all_vectors]
    all_embeddings: List[List[float]] = []

    log.info("  Embedding %d texts in batches of %d...", len(embed_texts), EMBED_BATCH)
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
                log.info("    Embedded batch %d/%d (%d texts)",
                         batch_num, total_batches, len(batch))
                break
            except Exception as e:
                wait = min(2 ** attempt, 30)
                log.warning("    Embed error (attempt %d): %s — retrying in %ds",
                            attempt, str(e)[:80], wait)
                time.sleep(wait)
                if attempt >= 5:
                    raise

    # ── Step 2: Upsert ──
    log.info("  Upserting %d vectors to '%s'...", len(all_embeddings), PINECONE_NS)

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
                log.info("    Upserted batch %d/%d (%d vectors)",
                         batch_num, total_batches, len(batch))
                break
            except Exception as e:
                wait = min(2 ** attempt, 15)
                log.warning("    Upsert error (attempt %d): %s — retrying in %ds",
                            attempt, str(e)[:120], wait)
                time.sleep(wait)
                if attempt >= 3:
                    log.error("    FAILED batch at index %d", i)
                    raise

    # ── Final stats ───────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 70)
    log.info("  ✅ PIPELINE COMPLETE")
    log.info("=" * 70)
    log.info("  Embedded:   %d", len(all_embeddings))
    log.info("  Upserted:   %d", upserted)
    log.info("  Namespace:  %s", PINECONE_NS)

    # Verify
    time.sleep(3)
    try:
        idx_stats = index.describe_index_stats()
        ns_data = idx_stats.get("namespaces", {}).get(PINECONE_NS, {})
        log.info("  Pinecone vectors in '%s': %s",
                 PINECONE_NS, ns_data.get("vector_count", "?"))
    except Exception:
        pass

    log.info("=" * 70)


# ═════════════════════════════════════════════════════════════════════════════
# CLI
# ═════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Rules & Regulations PDF Ingestion Pipeline"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate only — no embedding/upserting")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already processed files")

    args = parser.parse_args()
    run_pipeline(dry_run=args.dry_run, resume=args.resume)
