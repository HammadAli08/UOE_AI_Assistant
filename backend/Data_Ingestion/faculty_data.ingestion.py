"""
faculty_ingestion.py
====================
Ingestion pipeline for faculty_profiles.json
into Pinecone namespace: faculty

CHUNK DESIGN:
─────────────────────────────────────────────────────────────
  faculty_bio           →  1 chunk per faculty member
      Name + position + email + introduction + qualifications
      + research interests + awards/certifications.
      Answers: "Who is Dr. Anwar?", "Tell me about Usman Rafi's background."

  faculty_publications  →  1 chunk per faculty member
      Name + all their journal and conference papers in a structured list.
      Answers: "What papers did Usman Rafi publish?", "Dr. Anwar's journal articles."

  faculty_experience    →  1 chunk per faculty member
      Name + full employment history (where and when they worked).
      Answers: "Where did Usman Rafi work before UE?", "Dr. Anwar's industry experience."
─────────────────────────────────────────────────────────────

METADATA SCHEMA:
  namespace         → "faculty"
  chunk_type        → faculty_bio | faculty_publications | faculty_experience
  faculty_name      → full name
  faculty_position  → current position (e.g., Lecturer, Assistant Professor)
  faculty_email     → email address (cleaned)
  campus_name       → campus they are affiliated with
  is_phd            → boolean (true if they have a PhD)
  is_hec_supervisor → boolean (for faculty with HEC approval)
  source_file       → filename
  chunk_id          → stable unique identifier
  text              → full chunk text (for retrieval)
  text_preview      → first 200 chars
  chunk_length      → character count

Usage:
  python faculty_ingestion.py
  python faculty_ingestion.py --dry-run   # parse only, no upload
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import re

from dotenv import load_dotenv
from tqdm import tqdm

load_dotenv()

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

JSON_FILE = Path(
    "/home/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend/Data"
    "/About/teachers.json"
)

LOG_FILE  = Path("faculty_ingestion.log")

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
# DATA HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _clean_email(email) -> str:
    """
    Return empty string for placeholder emails.
    Placeholders found in the data: "0", "abc@gmail.com", "abc@abc.com", null
    """
    if not email:
        return ""
    s = str(email).strip()
    junk = {"0", "abc@gmail.com", "abc@abc.com", "null", "none", ""}
    if s.lower() in junk:
        return ""
    return s


def _extract_year_from_string(date_str: str) -> Optional[str]:
    """Extract a 4-digit year from a date string like 'March 2019 - Present' or '2015'."""
    match = re.search(r'\b(19|20)\d{2}\b', date_str)
    return match.group(0) if match else None


def _has_phd(qualifications: List[str]) -> bool:
    """Check if any qualification contains 'PhD' or 'Ph.D'."""
    for q in qualifications:
        if re.search(r'ph\.?\s*d|phd', q, re.IGNORECASE):
            return True
    return False


def _chunk_id(label: str) -> str:
    """Stable, deterministic chunk ID from a label string."""
    return hashlib.md5(label.encode("utf-8")).hexdigest()[:16]


def _format_publication_authors(authors_str: str) -> str:
    """
    Clean up author strings that might contain line breaks or extra spaces.
    """
    return re.sub(r'\s+', ' ', authors_str).strip()


# ─────────────────────────────────────────────────────────────────────────────
# CHUNK BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_faculty_bio_chunk(faculty: Dict) -> Dict:
    """
    One chunk per faculty member containing biographical information:
    - Name, position, email
    - Introduction/background
    - Qualifications (degrees)
    - Research interests (if mentioned in intro)
    - Awards and certifications
    """
    name = faculty.get("name", "Unknown Faculty")
    position = faculty.get("position", "")
    email = _clean_email(faculty.get("email", ""))
    campus = faculty.get("campus", "")
    intro = faculty.get("introduction", "")
    qualifications = faculty.get("qualification", [])
    awards = faculty.get("awards_certifications", [])
    is_hec = faculty.get("hec_approved_supervisor", False)

    # Extract research interests from introduction if present
    research_interests = ""
    if "research interests" in intro.lower():
        # Try to grab the sentence containing "research interests"
        sentences = intro.split('.')
        for sent in sentences:
            if "research interest" in sent.lower():
                research_interests = sent.strip()
                break

    # Format qualifications
    qual_lines = "\n".join(f"  - {q}" for q in qualifications) if qualifications else "  - Not specified"

    # Format awards
    award_lines = "\n".join(f"  - {a}" for a in awards) if awards else "  - None listed"

    # Build the text
    text = (
        f"Faculty Profile: {name}\n"
        f"{'=' * (len(name) + 16)}\n\n"
        f"Position: {position}\n"
        f"Email: {email if email else 'Not available'}\n"
        f"Campus: {campus}\n"
        f"HEC Approved Supervisor: {'Yes' if is_hec else 'No'}\n\n"
        f"Biography:\n{intro}\n\n"
        f"Qualifications:\n{qual_lines}\n\n"
        f"Research Interests:\n  - {research_interests if research_interests else 'See biography for details'}\n\n"
        f"Awards & Certifications:\n{award_lines}"
    )

    return {
        "text": text.strip(),
        "chunk_type": "faculty_bio",
        "faculty_name": name,
        "faculty_position": position,
        "faculty_email": email,
        "campus_name": campus,
        "is_phd": _has_phd(qualifications),
        "is_hec_supervisor": is_hec,
        "chunk_id": _chunk_id(f"faculty_bio_{name}"),
        "source_file": JSON_FILE.name,
    }


def build_faculty_publications_chunk(faculty: Dict) -> Optional[Dict]:
    """
    One chunk per faculty member containing all their publications:
    - Journal papers
    - Conference papers
    """
    name = faculty.get("name", "Unknown Faculty")
    position = faculty.get("position", "")
    campus = faculty.get("campus", "")
    journal_papers = faculty.get("journal_papers", [])
    conference_papers = faculty.get("conference_papers", [])

    # Skip if no publications
    if not journal_papers and not conference_papers:
        return None

    # Format journal papers
    journal_lines = []
    for paper in journal_papers:
        authors = _format_publication_authors(paper.get("authors", ""))
        title = paper.get("title", "")
        journal = paper.get("journal", "")
        year = paper.get("year", "")
        if year:
            line = f"  - {authors} ({year}). {title}. *{journal}*"
        else:
            line = f"  - {authors}. {title}. *{journal}*"
        journal_lines.append(line)

    # Format conference papers
    conf_lines = []
    for paper in conference_papers:
        authors = _format_publication_authors(paper.get("authors", ""))
        title = paper.get("title", "")
        conference = paper.get("conference", "")
        year = paper.get("year", "")
        if year:
            line = f"  - {authors} ({year}). {title}. In: *{conference}*"
        else:
            line = f"  - {authors}. {title}. In: *{conference}*"
        conf_lines.append(line)

    # Build the text
    sections = []
    sections.append(f"Publications: {name}")
    sections.append(f"{'=' * (len(name) + 14)}")
    sections.append(f"Faculty: {name} | {position} | {campus}\n")

    if journal_lines:
        sections.append("Journal Papers:")
        sections.extend(journal_lines)
        sections.append("")

    if conf_lines:
        sections.append("Conference Papers:")
        sections.extend(conf_lines)

    text = "\n".join(sections).strip()

    return {
        "text": text,
        "chunk_type": "faculty_publications",
        "faculty_name": name,
        "faculty_position": position,
        "faculty_email": _clean_email(faculty.get("email", "")),
        "campus_name": campus,
        "is_phd": _has_phd(faculty.get("qualification", [])),
        "is_hec_supervisor": faculty.get("hec_approved_supervisor", False),
        "chunk_id": _chunk_id(f"faculty_pubs_{name}"),
        "source_file": JSON_FILE.name,
    }


def build_faculty_experience_chunk(faculty: Dict) -> Optional[Dict]:
    """
    One chunk per faculty member containing their employment history.
    """
    name = faculty.get("name", "Unknown Faculty")
    position = faculty.get("position", "")
    campus = faculty.get("campus", "")
    experience = faculty.get("experience", [])

    # Skip if no experience listed
    if not experience:
        return None

    # Format experience entries
    exp_lines = []
    for exp in experience:
        title = exp.get("title", "")
        institution = exp.get("institution", "")
        period = exp.get("period", "")
        if title and institution:
            line = f"  - {title} at {institution}"
            if period:
                line += f" ({period})"
            exp_lines.append(line)

    if not exp_lines:
        return None

    # Build the text
    text = (
        f"Employment History: {name}\n"
        f"{'=' * (len(name) + 20)}\n\n"
        f"Faculty: {name} | Current Position: {position} | {campus}\n\n"
        f"Work Experience:\n" + "\n".join(exp_lines)
    )

    return {
        "text": text.strip(),
        "chunk_type": "faculty_experience",
        "faculty_name": name,
        "faculty_position": position,
        "faculty_email": _clean_email(faculty.get("email", "")),
        "campus_name": campus,
        "is_phd": _has_phd(faculty.get("qualification", [])),
        "is_hec_supervisor": faculty.get("hec_approved_supervisor", False),
        "chunk_id": _chunk_id(f"faculty_exp_{name}"),
        "source_file": JSON_FILE.name,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_json(data: Dict) -> List[Dict]:
    """
    Parse the faculty JSON and return a flat list of chunk dicts.
    Each dict has: text + all metadata fields.
    """
    chunks: List[Dict] = []
    faculty_list = data.get("faculty", [])

    log.info(f"Processing {len(faculty_list)} faculty members")

    for faculty in faculty_list:
        name = faculty.get("name", "Unknown")
        
        # 1 — Faculty bio (always present)
        bio_chunk = build_faculty_bio_chunk(faculty)
        if bio_chunk:
            chunks.append(bio_chunk)
            log.debug(f"  + {name}: bio")

        # 2 — Faculty publications (if any)
        pubs_chunk = build_faculty_publications_chunk(faculty)
        if pubs_chunk:
            chunks.append(pubs_chunk)
            log.debug(f"  + {name}: publications")

        # 3 — Faculty experience (if any)
        exp_chunk = build_faculty_experience_chunk(faculty)
        if exp_chunk:
            chunks.append(exp_chunk)
            log.debug(f"  + {name}: experience")

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# METADATA FINALIZER
# ─────────────────────────────────────────────────────────────────────────────

def finalize_metadata(chunk: Dict, chunk_index: int, total: int) -> Dict:
    """
    Attach remaining metadata fields to a chunk dict.
    Handles the 38 KB Pinecone metadata text limit safely.
    """
    text = chunk["text"]

    # Safe byte truncation — Pinecone metadata limit is 40 KB
    text_safe = text.encode("utf-8")[:38_000].decode("utf-8", errors="ignore")

    return {
        # ── Namespace and identity ────────────────────────────────────────────
        "namespace":          PINECONE_NS,
        "source_file":        chunk["source_file"],
        "chunk_id":           chunk["chunk_id"],
        "chunk_index":        chunk_index,
        "total_chunks":       total,

        # ── Chunk classification ──────────────────────────────────────────────
        "chunk_type":         chunk["chunk_type"],

        # ── Faculty metadata ──────────────────────────────────────────────────
        "faculty_name":        chunk.get("faculty_name", ""),
        "faculty_position":    chunk.get("faculty_position", ""),
        "faculty_email":       chunk.get("faculty_email", ""),
        "campus_name":         chunk.get("campus_name", ""),
        "is_phd":              chunk.get("is_phd", False),
        "is_hec_supervisor":   chunk.get("is_hec_supervisor", False),

        # ── Content metadata ──────────────────────────────────────────────────
        "chunk_length":       len(text),
        "text_preview":       text[:200].strip(),
        "text":               text_safe,

        # ── Timestamp ─────────────────────────────────────────────────────────
        "ingested_at":        datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# EMBEDDING + UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def embed_and_upsert(
    metas:   List[Dict],
    index,
    embedder,
    dry_run: bool = False,
) -> int:
    """Embed texts and upsert to Pinecone. Returns vector count."""
    texts = [m["text"] for m in metas]
    total = 0

    for i in range(0, len(texts), EMBED_BATCH):
        batch_texts = texts[i: i + EMBED_BATCH]
        batch_metas = metas[i: i + EMBED_BATCH]

        try:
            vectors_raw = embedder.embed_documents(batch_texts)
        except Exception as e:
            log.error(f"  Embedding error (batch {i}): {e}")
            continue

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

        for j in range(0, len(records), UPSERT_BATCH):
            sub = records[j: j + UPSERT_BATCH]
            try:
                index.upsert(vectors=sub, namespace=PINECONE_NS)
                total += len(sub)
            except Exception as e:
                log.error(f"  Upsert error: {e}")

    return total


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Faculty Profiles Pinecone ingestion")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and embed only — no Pinecone upsert")
    args = parser.parse_args()

    # ── Validate env vars ─────────────────────────────────────────────────────
    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")

    # ── Load JSON ─────────────────────────────────────────────────────────────
    if not JSON_FILE.exists():
        raise FileNotFoundError(f"JSON file not found: {JSON_FILE}")

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    log.info(f"\n{'='*60}")
    log.info(f"Faculty Profiles Ingestion")
    log.info(f"Source  : {JSON_FILE.name}")
    log.info(f"NS      : {PINECONE_NS}")
    log.info(f"Dry-run : {args.dry_run}")
    log.info(f"{'='*60}\n")

    # ── Parse JSON into chunks ────────────────────────────────────────────────
    raw_chunks = parse_json(data)
    log.info(f"\nParsed {len(raw_chunks)} total chunks:")

    # Print chunk inventory
    from collections import Counter
    counts = Counter(c["chunk_type"] for c in raw_chunks)
    for ctype, n in sorted(counts.items()):
        log.info(f"  {ctype:<20} {n} chunks")

    # ── Finalize metadata ─────────────────────────────────────────────────────
    metas = [
        finalize_metadata(chunk, i, len(raw_chunks))
        for i, chunk in enumerate(raw_chunks)
    ]

    # ── Setup Pinecone + OpenAI ───────────────────────────────────────────────
    from pinecone import Pinecone, ServerlessSpec
    from langchain_openai import OpenAIEmbeddings

    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

    existing = [idx.name for idx in pc.list_indexes()]
    if PINECONE_INDEX not in existing:
        log.info(f"Creating index '{PINECONE_INDEX}' ...")
        pc.create_index(
            name      = PINECONE_INDEX,
            dimension = PINECONE_DIM,
            metric    = PINECONE_METRIC,
            spec      = ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
        )
        import time; time.sleep(10)

    index = pc.Index(PINECONE_INDEX)

    embedder = OpenAIEmbeddings(
        model          = OPENAI_MODEL,
        openai_api_key = os.getenv("OPENAI_API_KEY"),
    )

    # ── Embed + Upsert ────────────────────────────────────────────────────────
    log.info(f"\nEmbedding and upserting {len(metas)} vectors ...")
    n = embed_and_upsert(metas, index, embedder, dry_run=args.dry_run)

    log.info(f"\n{'='*60}")
    log.info(f"DONE")
    log.info(f"Vectors upserted : {n}")
    log.info(f"Namespace        : {PINECONE_NS}")
    log.info(f"{'='*60}\n")


if __name__ == "__main__":
    main()