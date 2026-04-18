"""
university_about_ingestion.py
==============================
UNIFIED ingestion pipeline for ALL JSON files in backend/Data/About/
into Pinecone namespace: about-university

DATA SOURCES (5 files):
─────────────────────────────────────────────────────────────
  1. university&campus_information.json  →  ~37 chunks
       university_overview (1), facility (7), campus_overview (9),
       campus_departments (9), campus_staff (9), academic_programs (1)

  2. about_university.json               →  ~140 chunks
       program_summary — one per program entry

  3. contact_information.json            →  ~31 chunks
       contact_directory — one per official

  4. fee_information.json                →  ~44 chunks
       program_fee — one per program-shift fee entry

  5. teachers.json                       →  ~2 chunks
       faculty_profile — one per faculty member
─────────────────────────────────────────────────────────────
TOTAL ESTIMATED: ~254 vectors

METADATA SCHEMA (GLOBAL):
  namespace         → "about-university"
  chunk_type        → university_overview | facility | campus_overview |
                      campus_departments | campus_staff | academic_programs |
                      program_summary | contact_directory | program_fee |
                      faculty_profile
  source_file       → filename that produced the chunk
  chunk_id          → stable deterministic identifier

  (conditional — populated per chunk_type):
  campus_name       → campus name (campus chunks)
  campus_city       → city (campus chunks)
  campus_is_lahore  → bool (campus chunks)
  facility_type     → library | it_lab | etc. (facility chunks)
  program           → program name (fee / summary chunks)
  shift             → Morning | Evening (fee chunks)
  person_name       → full name (contact / faculty chunks)
  person_title      → title / designation
  department        → department name
  category          → admin / campus / student_services / academic

Usage:
  python university_about_ingestion.py
  python university_about_ingestion.py --dry-run
  python university_about_ingestion.py --resume
"""

import os
import sys
import json
import logging
import hashlib
import time
import argparse
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime
from collections import Counter

from dotenv import load_dotenv
from tqdm import tqdm

# ─────────────────────────────────────────────────────────────────────────────
# Load env from backend/.env
# ─────────────────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PINECONE_INDEX   = "uoeaiassistant"
PINECONE_NS      = "about-university"
PINECONE_DIM     = 3072
PINECONE_METRIC  = "cosine"
PINECONE_CLOUD   = "aws"
PINECONE_REGION  = "us-east-1"

OPENAI_MODEL     = "text-embedding-3-large"
EMBED_BATCH      = 20
UPSERT_BATCH     = 100

DATA_DIR = BACKEND_DIR / "Data" / "About"

# The 5 source files
FILES = {
    "campus":   DATA_DIR / "university&campus_information.json",
    "about":    DATA_DIR / "about_university.json",
    "contacts": DATA_DIR / "contact_information.json",
    "fees":     DATA_DIR / "fee_information.json",
    "teachers": DATA_DIR / "teachers.json",
}

LOG_FILE     = Path(__file__).resolve().parent / "about_university_ingestion.log"
PROGRESS_FILE = Path(__file__).resolve().parent / "about_university_progress.json"

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

# ─────────────────────────────────────────────────────────────────────────────
# UTILITY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _chunk_id(label: str) -> str:
    """Stable, deterministic chunk ID from a label string."""
    return hashlib.md5(label.encode("utf-8")).hexdigest()[:16]


def _clean_email(email) -> str:
    """Return empty string for placeholder or junk emails."""
    if not email:
        return ""
    s = str(email).strip()
    junk = {"0", "abc@gmail.com", "abc@abc.com", "null", "none", ""}
    if s.lower() in junk:
        return ""
    return s


def _city_from_address(address: Optional[str]) -> str:
    """Extract city name from an address string."""
    if not address:
        return ""
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 3:
        return parts[-3].strip()
    if len(parts) >= 2:
        return parts[-2].strip()
    return ""


def _is_lahore(campus_name: str, address: Optional[str]) -> bool:
    text = f"{campus_name} {address or ''}".lower()
    return "lahore" in text


def _safe_text(text: str, max_bytes: int = 38_000) -> str:
    """Truncate text to fit within Pinecone 40KB metadata limit."""
    return text.encode("utf-8")[:max_bytes].decode("utf-8", errors="ignore")


def _load_json(path: Path) -> Any:
    """Load a JSON file and return parsed data."""
    if not path.exists():
        log.warning(f"  ⚠️  File not found: {path.name}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ═════════════════════════════════════════════════════════════════════════════
# CHUNK BUILDERS — One per source file
# ═════════════════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────────────────
# 1. university&campus_information.json
# ──────────────────────────────────────────────────────────────────────────────

def build_campus_info_chunks(data: Dict) -> List[Dict]:
    """Parse university & campus info into structured chunks."""
    chunks: List[Dict] = []
    src = "university&campus_information.json"

    # ── University overview ──────────────────────────────────────────────────
    goals_text = "\n".join(f"  - {g}" for g in data.get("goals", []))
    text = (
        f"University of Education (UE) — Overview\n\n"
        f"Introduction:\n{data.get('introduction', '')}\n\n"
        f"Vision:\n{data.get('vision', '')}\n\n"
        f"Mission:\n{data.get('mission', '')}\n\n"
        f"Goals:\n{goals_text}"
    )
    chunks.append({
        "text": text.strip(),
        "chunk_type": "university_overview",
        "campus_name": "", "campus_city": "", "campus_is_lahore": False,
        "facility_type": "", "chunk_id": _chunk_id("university_overview"),
        "source_file": src,
    })

    # ── Facilities ───────────────────────────────────────────────────────────
    fs = data.get("facilities_services", {})

    simple_facilities = {
        "library":                  ("Library",               "library"),
        "access_to_it_resources":   ("IT Labs / Computer Labs","it_lab"),
        "science_laboratories":     ("Science Laboratories",  "science_lab"),
        "hostel":                   ("Hostel",                "hostel"),
        "video_conferencing_room":  ("Video Conferencing Room","video_conferencing"),
    }

    for key, (label, ftype) in simple_facilities.items():
        value = fs.get(key, "")
        if not value:
            continue
        text = f"University of Education — {label}\n\n{value}"
        chunks.append({
            "text": text.strip(),
            "chunk_type": "facility",
            "campus_name": "", "campus_city": "", "campus_is_lahore": False,
            "facility_type": ftype,
            "chunk_id": _chunk_id(f"facility_{ftype}"),
            "source_file": src,
        })

    # HEC Digital Library
    hec = fs.get("hec_digital_library", {})
    if hec:
        resources = "\n".join(f"  - {r}" for r in hec.get("resources", []))
        text = (
            f"University of Education — HEC National Digital Library\n\n"
            f"{hec.get('description', '')}\n\n"
            f"Available Digital Resources:\n{resources}"
        )
        chunks.append({
            "text": text.strip(),
            "chunk_type": "facility",
            "campus_name": "", "campus_city": "", "campus_is_lahore": False,
            "facility_type": "hec_digital_library",
            "chunk_id": _chunk_id("facility_hec_digital_library"),
            "source_file": src,
        })

    # PERN
    pern = fs.get("pern", {})
    if pern:
        bw_lines = "\n".join(
            f"  - {b['year']}: {b['bandwidth']}"
            for b in pern.get("bandwidth_history", [])
        )
        text = (
            f"University of Education — PERN (Pakistan Education & Research Network)\n\n"
            f"{pern.get('description', '')}\n\n"
            f"Internet Bandwidth History at UE:\n{bw_lines}"
        )
        chunks.append({
            "text": text.strip(),
            "chunk_type": "facility",
            "campus_name": "", "campus_city": "", "campus_is_lahore": False,
            "facility_type": "pern",
            "chunk_id": _chunk_id("facility_pern"),
            "source_file": src,
        })

    # ── Academic programs listing ────────────────────────────────────────────
    programs = data.get("academic_programs", {})
    if programs:
        lines = []
        for level, prog_list in programs.items():
            if isinstance(prog_list, list):
                level_name = level.replace("_", " ").title()
                lines.append(f"\n{level_name}:")
                for p in prog_list:
                    lines.append(f"  - {p}")
        if lines:
            text = "University of Education — Academic Programs Offered\n" + "\n".join(lines)
            chunks.append({
                "text": text.strip(),
                "chunk_type": "academic_programs",
                "campus_name": "", "campus_city": "", "campus_is_lahore": False,
                "facility_type": "",
                "chunk_id": _chunk_id("academic_programs_listing"),
                "source_file": src,
            })

    # ── Per-campus chunks (3 per campus) ─────────────────────────────────────
    for campus in data.get("campuses", []):
        name = campus.get("name", "Unknown Campus")
        contact = campus.get("contact", {})
        address = contact.get("address", "")
        city = _city_from_address(address)
        is_lhr = _is_lahore(name, address)

        base = {
            "campus_name": name, "campus_city": city,
            "campus_is_lahore": is_lhr, "facility_type": "",
            "source_file": src,
        }

        # Campus overview + contact
        principal = contact.get("principal") or "Not listed"
        phone = contact.get("phone", "")
        fax = contact.get("fax", "")
        email = _clean_email(contact.get("email"))

        contact_block = (
            f"Principal: {principal}\n"
            f"Address: {address}\n"
            f"Phone: {phone}\n"
            f"Fax: {fax}\n"
            f"Email: {email if email else 'Not available'}"
        )
        text = (
            f"{name} — Overview\n\n"
            f"{campus.get('overview', '')}\n\n"
            f"Contact Information:\n{contact_block}"
        )
        chunks.append({
            **base, "text": text.strip(),
            "chunk_type": "campus_overview",
            "chunk_id": _chunk_id(f"campus_overview_{name}"),
        })

        # Campus departments
        depts = campus.get("departments", [])
        if depts:
            dept_lines = "\n".join(f"  - {d}" for d in depts)
            text = (
                f"{name} — Departments\n\n"
                f"Campus: {name}\n"
                f"Total Departments: {len(depts)}\n\n"
                f"Departments:\n{dept_lines}"
            )
            chunks.append({
                **base, "text": text.strip(),
                "chunk_type": "campus_departments",
                "chunk_id": _chunk_id(f"campus_departments_{name}"),
            })

        # Campus staff
        staff = campus.get("staff", [])
        valid_staff = [
            s for s in staff
            if s.get("name", "").strip()
            and s["name"].strip().lower() not in {"0", "", "null"}
        ]
        if valid_staff:
            staff_lines = []
            for s in valid_staff:
                email = _clean_email(s.get("email"))
                line = f"  - {s['name']} | {s.get('title', 'N/A')}"
                if email:
                    line += f" | {email}"
                staff_lines.append(line)

            text = (
                f"{name} — Staff Directory\n\n"
                f"Campus: {name}\n"
                f"Total Staff Listed: {len(valid_staff)}\n\n"
                f"Staff Members:\n" + "\n".join(staff_lines)
            )
            chunks.append({
                **base, "text": text.strip(),
                "chunk_type": "campus_staff",
                "chunk_id": _chunk_id(f"campus_staff_{name}"),
            })

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# 2. about_university.json  (program summaries)
# ──────────────────────────────────────────────────────────────────────────────

def build_program_summary_chunks(data: List[Dict]) -> List[Dict]:
    """One chunk per program summary entry."""
    chunks: List[Dict] = []
    src = "about_university.json"

    for entry in data:
        prog_id = entry.get("id", "unknown")
        source_file = entry.get("source_file", "")
        summary = entry.get("summary", "")

        if not summary or len(summary.strip()) < 50:
            log.warning(f"  ⚠️  Skipping thin summary: {prog_id}")
            continue

        # Extract program name from source_file for better searchability
        prog_name = source_file.replace(".pdf", "").strip()
        # Clean up leading number prefix like "9-ADP..." or "4-BFA..."
        if prog_name and prog_name[0].isdigit() and "-" in prog_name:
            prog_name = prog_name.split("-", 1)[1].strip()

        text = (
            f"Program Summary: {prog_name}\n"
            f"Source Document: {source_file}\n\n"
            f"{summary}"
        )

        chunks.append({
            "text": text.strip(),
            "chunk_type": "program_summary",
            "program": prog_name,
            "program_id": prog_id,
            "source_file": src,
            "original_pdf": source_file,
            "chunk_id": _chunk_id(f"program_summary_{prog_id}"),
        })

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# 3. contact_information.json
# ──────────────────────────────────────────────────────────────────────────────

def build_contact_chunks(data: List[Dict]) -> List[Dict]:
    """One chunk per official contact entry."""
    chunks: List[Dict] = []
    src = "contact_information.json"

    for entry in data:
        content = entry.get("content", "")
        meta = entry.get("metadata", {})

        name = meta.get("name", "Unknown")
        title = meta.get("title", "")
        department = meta.get("department", "")
        email = _clean_email(meta.get("email"))
        phone = meta.get("phone", "")
        category = meta.get("category", "university_administration")

        # Build a rich, self-contained text
        lines = [f"Contact: {name}"]
        if title:
            lines.append(f"Title: {title}")
        if department:
            lines.append(f"Department: {department}")
        if email:
            lines.append(f"Email: {email}")
        if phone:
            lines.append(f"Phone: {phone}")
        fax = meta.get("fax", "")
        if fax:
            lines.append(f"Fax: {fax}")
        address = meta.get("address", "")
        if address:
            lines.append(f"Address: {address}")

        # Also include the original content block for semantic richness
        lines.append(f"\n{content}")

        text = "\n".join(lines)

        chunks.append({
            "text": text.strip(),
            "chunk_type": "contact_directory",
            "person_name": name,
            "person_title": title,
            "department": department,
            "category": category,
            "source_file": src,
            "chunk_id": _chunk_id(f"contact_{name}_{department}"),
        })

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# 4. fee_information.json
# ──────────────────────────────────────────────────────────────────────────────

def build_fee_chunks(data: List[Dict]) -> List[Dict]:
    """One chunk per program-shift fee entry."""
    chunks: List[Dict] = []
    src = "fee_information.json"

    for entry in data:
        content = entry.get("content", "")
        meta = entry.get("metadata", {})

        program = meta.get("program", "Unknown Program")
        shift = meta.get("shift", "")
        sem1 = meta.get("semester_1_fee", "N/A")
        sem2 = meta.get("semester_2_fee", "N/A")
        level = meta.get("level", "")
        fee_type = meta.get("fee_type", "Tuition")

        sem1_str = f"{sem1:,}" if isinstance(sem1, (int, float)) else str(sem1)
        sem2_str = f"{sem2:,}" if isinstance(sem2, (int, float)) else str(sem2)

        text = (
            f"Fee Structure: {program}\n"
            f"Shift: {shift}\n"
            f"Level: {level}\n"
            f"Fee Type: {fee_type}\n"
            f"1st Semester Fee: Rs. {sem1_str}\n"
            f"2nd Semester Fee: Rs. {sem2_str}\n\n"
            f"{content}"
        )

        chunks.append({
            "text": text.strip(),
            "chunk_type": "program_fee",
            "program": program,
            "shift": shift,
            "level": level,
            "semester_1_fee": str(sem1),
            "semester_2_fee": str(sem2),
            "source_file": src,
            "chunk_id": _chunk_id(f"fee_{program}_{shift}"),
        })

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# 5. teachers.json
# ──────────────────────────────────────────────────────────────────────────────

def build_faculty_chunks(data: Dict) -> List[Dict]:
    """One chunk per faculty member."""
    chunks: List[Dict] = []
    src = "teachers.json"

    faculty_list = data.get("faculty", [])

    for member in faculty_list:
        name = member.get("name", "Unknown")
        position = member.get("position", "")
        email = _clean_email(member.get("email"))
        campus = member.get("campus", "")
        intro = member.get("introduction", "")

        # Qualifications
        quals = member.get("qualification", [])
        qual_text = "\n".join(f"  - {q}" for q in quals) if quals else "Not listed"

        # Experience
        experiences = member.get("experience", [])
        exp_lines = []
        for exp in experiences:
            exp_lines.append(
                f"  - {exp.get('title', '')} at {exp.get('institution', '')} "
                f"({exp.get('period', '')})"
            )
        exp_text = "\n".join(exp_lines) if exp_lines else "Not listed"

        # Research publications count
        journal_count = len(member.get("journal_papers", []))
        conf_count = len(member.get("conference_papers", []))

        # Awards / Certifications
        awards = member.get("awards_certifications", [])
        awards_text = "\n".join(f"  - {a}" for a in awards) if awards else "None listed"

        # HEC supervisor
        hec_supervisor = member.get("hec_approved_supervisor", False)

        text = (
            f"Faculty Profile: {name}\n"
            f"Position: {position}\n"
            f"Campus: {campus}\n"
            f"Email: {email if email else 'Not available'}\n"
            f"HEC Approved Supervisor: {'Yes' if hec_supervisor else 'No'}\n\n"
            f"Introduction:\n{intro}\n\n"
            f"Qualifications:\n{qual_text}\n\n"
            f"Experience:\n{exp_text}\n\n"
            f"Research Output: {journal_count} journal papers, {conf_count} conference papers\n\n"
            f"Awards & Certifications:\n{awards_text}"
        )

        chunks.append({
            "text": text.strip(),
            "chunk_type": "faculty_profile",
            "person_name": name,
            "person_title": position,
            "campus": campus,
            "hec_supervisor": hec_supervisor,
            "source_file": src,
            "chunk_id": _chunk_id(f"faculty_{name}_{campus}"),
        })

    return chunks


# ═════════════════════════════════════════════════════════════════════════════
# METADATA FINALIZER
# ═════════════════════════════════════════════════════════════════════════════

def finalize_metadata(chunk: Dict, chunk_index: int, total: int) -> Dict:
    """
    Attach final metadata fields to a chunk dict.
    Ensures clean Pinecone-compatible metadata (no None values).
    """
    text = _safe_text(chunk["text"])

    meta = {
        # ── Identity ──
        "namespace":      PINECONE_NS,
        "source_file":    chunk.get("source_file", ""),
        "chunk_id":       chunk["chunk_id"],
        "chunk_index":    chunk_index,
        "total_chunks":   total,

        # ── Chunk classification ──
        "chunk_type":     chunk["chunk_type"],

        # ── Content ──
        "chunk_length":   len(chunk["text"]),
        "text_preview":   chunk["text"][:200].strip(),
        "text":           text,

        # ── Timestamp ──
        "ingested_at":    datetime.now().isoformat(),
    }

    # ── Conditional fields — only set if non-empty ──
    optional_fields = [
        "campus_name", "campus_city", "campus_is_lahore",
        "facility_type", "program", "program_id", "original_pdf",
        "shift", "level", "semester_1_fee", "semester_2_fee",
        "person_name", "person_title", "department", "category",
        "campus", "hec_supervisor",
    ]

    for field in optional_fields:
        value = chunk.get(field)
        if value is not None and value != "":
            meta[field] = value

    return meta


# ═════════════════════════════════════════════════════════════════════════════
# EMBED + UPSERT
# ═════════════════════════════════════════════════════════════════════════════

def embed_and_upsert(
    metas:    List[Dict],
    index,
    embedder,
    dry_run:  bool = False,
) -> int:
    """Embed texts and upsert to Pinecone. Returns vector count."""
    texts = [m["text"] for m in metas]
    total = 0

    for i in tqdm(range(0, len(texts), EMBED_BATCH), desc="Embedding & upserting"):
        batch_texts = texts[i: i + EMBED_BATCH]
        batch_metas = metas[i: i + EMBED_BATCH]

        # ── Embed ──
        try:
            vectors_raw = embedder.embed_documents(batch_texts)
        except Exception as e:
            log.error(f"  ❌ Embedding error (batch {i}): {e}")
            continue

        # ── Build Pinecone records ──
        records = [
            {
                "id":       meta["chunk_id"],
                "values":   vec,
                "metadata": meta,
            }
            for meta, vec in zip(batch_metas, vectors_raw)
        ]

        if dry_run:
            log.info(f"  [dry-run] Would upsert {len(records)} vectors")
            total += len(records)
            continue

        # ── Upsert in sub-batches ──
        for j in range(0, len(records), UPSERT_BATCH):
            sub = records[j: j + UPSERT_BATCH]
            for attempt in range(3):
                try:
                    index.upsert(vectors=sub, namespace=PINECONE_NS)
                    total += len(sub)
                    break
                except Exception as e:
                    if attempt < 2:
                        log.warning(f"  ⚠️  Upsert retry {attempt + 1}: {e}")
                        time.sleep(2 ** attempt)
                    else:
                        log.error(f"  ❌ Upsert failed after 3 attempts: {e}")

    return total


# ═════════════════════════════════════════════════════════════════════════════
# PROGRESS TRACKING
# ═════════════════════════════════════════════════════════════════════════════

def load_progress() -> Dict:
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed_sources": []}


def save_progress(progress: Dict):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Unified About-University Pinecone Ingestion"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and validate only — no Pinecone upsert")
    parser.add_argument("--resume", action="store_true",
                        help="Skip already-ingested source files")
    args = parser.parse_args()

    # ── Header ────────────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 70)
    log.info("  ABOUT-UNIVERSITY UNIFIED INGESTION PIPELINE")
    log.info("=" * 70)
    log.info(f"  Mode:      {'DRY RUN' if args.dry_run else 'LIVE INGESTION'}")
    log.info(f"  Resume:    {args.resume}")
    log.info(f"  Source:    {DATA_DIR}")
    log.info(f"  Target:    {PINECONE_INDEX} / {PINECONE_NS}")
    log.info("")

    # ── Validate env vars ─────────────────────────────────────────────────────
    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")
    log.info("  ✅ API keys verified")

    # ── Progress tracking ─────────────────────────────────────────────────────
    progress = load_progress() if args.resume else {"completed_sources": []}

    # ═════════════════════════════════════════════════════════════════════════
    # PARSE ALL 5 FILES
    # ═════════════════════════════════════════════════════════════════════════

    all_chunks: List[Dict] = []

    # 1. University & Campus Info
    source_key = "campus"
    if source_key not in progress["completed_sources"]:
        data = _load_json(FILES[source_key])
        if data:
            chunks = build_campus_info_chunks(data)
            all_chunks.extend(chunks)
            log.info(f"  📍 {FILES[source_key].name}: {len(chunks)} chunks")
    else:
        log.info(f"  ⏭️  Skipping {FILES[source_key].name} (already ingested)")

    # 2. Program Summaries
    source_key = "about"
    if source_key not in progress["completed_sources"]:
        data = _load_json(FILES[source_key])
        if data:
            chunks = build_program_summary_chunks(data)
            all_chunks.extend(chunks)
            log.info(f"  📖 {FILES[source_key].name}: {len(chunks)} chunks")
    else:
        log.info(f"  ⏭️  Skipping {FILES[source_key].name} (already ingested)")

    # 3. Contact Directory
    source_key = "contacts"
    if source_key not in progress["completed_sources"]:
        data = _load_json(FILES[source_key])
        if data:
            chunks = build_contact_chunks(data)
            all_chunks.extend(chunks)
            log.info(f"  📞 {FILES[source_key].name}: {len(chunks)} chunks")
    else:
        log.info(f"  ⏭️  Skipping {FILES[source_key].name} (already ingested)")

    # 4. Fee Structures
    source_key = "fees"
    if source_key not in progress["completed_sources"]:
        data = _load_json(FILES[source_key])
        if data:
            chunks = build_fee_chunks(data)
            all_chunks.extend(chunks)
            log.info(f"  💰 {FILES[source_key].name}: {len(chunks)} chunks")
    else:
        log.info(f"  ⏭️  Skipping {FILES[source_key].name} (already ingested)")

    # 5. Faculty Profiles
    source_key = "teachers"
    if source_key not in progress["completed_sources"]:
        data = _load_json(FILES[source_key])
        if data:
            chunks = build_faculty_chunks(data)
            all_chunks.extend(chunks)
            log.info(f"  👨‍🏫 {FILES[source_key].name}: {len(chunks)} chunks")
    else:
        log.info(f"  ⏭️  Skipping {FILES[source_key].name} (already ingested)")

    # ── Chunk summary ─────────────────────────────────────────────────────────
    if not all_chunks:
        log.info("\n  ✅ Nothing to ingest (all sources already completed or empty)")
        return

    log.info(f"\n  Total chunks to ingest: {len(all_chunks)}")
    counts = Counter(c["chunk_type"] for c in all_chunks)
    for ctype, n in sorted(counts.items()):
        log.info(f"    {ctype:<25} {n}")

    # ── Finalize metadata ─────────────────────────────────────────────────────
    metas = [
        finalize_metadata(chunk, i, len(all_chunks))
        for i, chunk in enumerate(all_chunks)
    ]

    # ── Setup Pinecone + OpenAI ───────────────────────────────────────────────
    from pinecone import Pinecone, ServerlessSpec
    from langchain_openai import OpenAIEmbeddings

    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

    existing = [idx.name for idx in pc.list_indexes()]
    if PINECONE_INDEX not in existing:
        log.info(f"  Creating index '{PINECONE_INDEX}' ...")
        pc.create_index(
            name=PINECONE_INDEX,
            dimension=PINECONE_DIM,
            metric=PINECONE_METRIC,
            spec=ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
        time.sleep(10)

    index = pc.Index(PINECONE_INDEX)

    embedder = OpenAIEmbeddings(
        model=OPENAI_MODEL,
        openai_api_key=os.getenv("OPENAI_API_KEY"),
    )

    # ── Embed + Upsert ────────────────────────────────────────────────────────
    log.info(f"\n  Embedding and upserting {len(metas)} vectors ...")
    n = embed_and_upsert(metas, index, embedder, dry_run=args.dry_run)

    # ── Save progress ─────────────────────────────────────────────────────────
    if not args.dry_run and n > 0:
        for key in FILES:
            if key not in progress["completed_sources"]:
                progress["completed_sources"].append(key)
        save_progress(progress)

    # ── Final report ──────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 70)
    log.info(f"  {'DRY RUN COMPLETE' if args.dry_run else 'INGESTION COMPLETE'}")
    log.info(f"  Vectors {'validated' if args.dry_run else 'upserted'}: {n}")
    log.info(f"  Namespace: {PINECONE_NS}")

    # Print stats by source
    source_counts = Counter(c["source_file"] for c in all_chunks)
    for src, cnt in sorted(source_counts.items()):
        log.info(f"    {src:<45} {cnt} chunks")

    log.info("=" * 70)
    log.info("")


if __name__ == "__main__":
    main()