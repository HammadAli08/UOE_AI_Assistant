"""
about_university_ingestion.py
==============================
Ingestion pipeline for university_campus_information.json
into Pinecone namespace: about-university

CHUNK DESIGN (37 vectors total):
─────────────────────────────────────────────────────────────
  university_overview   →  1 chunk
      Intro + vision + mission + goals in one self-contained
      block. Answers: "What is UE?", "What is UE's vision?"

  facility              →  1 chunk per facility (7 total)
      Each facility as its own vector with a facility_type tag.
      Answers: "Does UE have a hostel?", "What is HEC digital library?"

  campus_overview       →  1 chunk per campus (9 total)
      Campus name + overview + full contact details together.
      Answers: "Tell me about Attock campus", "How to contact Multan campus?"

  campus_departments    →  1 chunk per campus (9 total)
      Campus name + all departments at that campus.
      Answers: "What departments are at DG Khan campus?"

  campus_staff          →  1 chunk per campus (9 total)
      All staff members (name + title + email) at that campus.
      Answers: "Who is the librarian at Faisalabad campus?"
─────────────────────────────────────────────────────────────

METADATA SCHEMA:
  namespace         → "about-university"
  chunk_type        → university_overview | facility | campus_overview |
                      campus_departments | campus_staff
  campus_name       → exact campus name (campus chunks only)
  campus_city       → city extracted from address
  campus_is_lahore  → bool (for filtering Lahore-specific queries)
  facility_type     → library | it_lab | science_lab | hostel |
                      hec_digital_library | pern | video_conferencing
  source_file       → filename
  chunk_id          → stable unique identifier
  text              → full chunk text (for retrieval)
  text_preview      → first 200 chars
  chunk_length      → character count

Usage:
  python about_university_ingestion.py
  python about_university_ingestion.py --dry-run   # parse only, no upload
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

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
    "/About/university&campus_information.json"
)

LOG_FILE  = Path("about_university_ingestion.log")

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


def _city_from_address(address: Optional[str]) -> str:
    """
    Extract city name from an address string.
    Most addresses follow: "Street, City, Punjab, Pakistan"
    """
    if not address:
        return ""
    parts = [p.strip() for p in address.split(",")]
    # City is usually the second-to-last before "Punjab, Pakistan"
    if len(parts) >= 3:
        return parts[-3].strip()
    if len(parts) >= 2:
        return parts[-2].strip()
    return ""


def _is_lahore(campus_name: str, address: Optional[str]) -> bool:
    text = f"{campus_name} {address or ''}".lower()
    return "lahore" in text


def _chunk_id(label: str) -> str:
    """Stable, deterministic chunk ID from a label string."""
    return hashlib.md5(label.encode("utf-8")).hexdigest()[:16]


# ─────────────────────────────────────────────────────────────────────────────
# CHUNK BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_university_overview(data: Dict) -> Dict:
    """
    One chunk for the entire university identity:
    introduction + vision + mission + goals.

    Why single chunk: a user asking "What is UE?" or "What is UE's mission?"
    needs the full picture. Splitting vision from mission from intro creates
    fragments that answer nothing on their own.
    """
    goals_text = "\n".join(f"  - {g}" for g in data.get("goals", []))

    text = (
        f"University of Education (UE) — Overview\n\n"
        f"Introduction:\n{data.get('introduction', '')}\n\n"
        f"Vision:\n{data.get('vision', '')}\n\n"
        f"Mission:\n{data.get('mission', '')}\n\n"
        f"Goals:\n{goals_text}"
    )

    return {
        "text":          text.strip(),
        "chunk_type":    "university_overview",
        "campus_name":   "",
        "campus_city":   "",
        "campus_is_lahore": False,
        "facility_type": "",
        "chunk_id":      _chunk_id("university_overview"),
        "source_file":   JSON_FILE.name,
    }


def build_facility_chunks(data: Dict) -> List[Dict]:
    """
    One chunk per facility type.

    Why separate: "Does UE have a hostel?" and "What is PERN?" are completely
    different queries. One facility vector per topic prevents dilution and
    gives each facility its own retrieval surface.
    """
    fs = data.get("facilities_services", {})
    chunks: List[Dict] = []

    # ── Simple string facilities ──────────────────────────────────────────────
    simple = {
        "library":           ("Library",              "library"),
        "access_to_it_resources": ("IT Labs / Computer Labs", "it_lab"),
        "science_laboratories":   ("Science Laboratories",   "science_lab"),
        "hostel":            ("Hostel",               "hostel"),
        "video_conferencing_room": ("Video Conferencing Room", "video_conferencing"),
    }

    for key, (label, ftype) in simple.items():
        value = fs.get(key, "")
        if not value:
            continue
        text = (
            f"University of Education — {label}\n\n"
            f"{value}"
        )
        chunks.append({
            "text":          text.strip(),
            "chunk_type":    "facility",
            "campus_name":   "",
            "campus_city":   "",
            "campus_is_lahore": False,
            "facility_type": ftype,
            "chunk_id":      _chunk_id(f"facility_{ftype}"),
            "source_file":   JSON_FILE.name,
        })

    # ── HEC Digital Library ───────────────────────────────────────────────────
    hec = fs.get("hec_digital_library", {})
    if hec:
        resources = "\n".join(f"  - {r}" for r in hec.get("resources", []))
        text = (
            f"University of Education — HEC National Digital Library\n\n"
            f"{hec.get('description', '')}\n\n"
            f"Available Digital Resources:\n{resources}"
        )
        chunks.append({
            "text":          text.strip(),
            "chunk_type":    "facility",
            "campus_name":   "",
            "campus_city":   "",
            "campus_is_lahore": False,
            "facility_type": "hec_digital_library",
            "chunk_id":      _chunk_id("facility_hec_digital_library"),
            "source_file":   JSON_FILE.name,
        })

    # ── PERN ──────────────────────────────────────────────────────────────────
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
            "text":          text.strip(),
            "chunk_type":    "facility",
            "campus_name":   "",
            "campus_city":   "",
            "campus_is_lahore": False,
            "facility_type": "pern",
            "chunk_id":      _chunk_id("facility_pern"),
            "source_file":   JSON_FILE.name,
        })

    return chunks


def build_campus_chunks(campus: Dict) -> List[Dict]:
    """
    Three chunks per campus:
      1. campus_overview  — overview text + all contact details
      2. campus_departments — all departments
      3. campus_staff     — all staff members

    Why three separate chunks per campus:
    - "Tell me about Attock campus" → needs overview
    - "What departments are at DG Khan?" → needs departments only
    - "Who is the librarian at Multan?" → needs staff only
    Mixing all three into one chunk would dilute the semantic signal for
    each query type, making retrieval less precise.
    """
    name    = campus.get("name", "Unknown Campus")
    contact = campus.get("contact", {})
    address = contact.get("address", "")
    city    = _city_from_address(address)
    is_lhr  = _is_lahore(name, address)

    base_meta = {
        "campus_name":      name,
        "campus_city":      city,
        "campus_is_lahore": is_lhr,
        "facility_type":    "",
        "source_file":      JSON_FILE.name,
    }

    chunks: List[Dict] = []

    # ── 1. Campus Overview + Contact ──────────────────────────────────────────
    principal = contact.get("principal") or "Not listed"
    phone     = contact.get("phone", "")
    fax       = contact.get("fax", "")
    email     = _clean_email(contact.get("email"))

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
        **base_meta,
        "text":       text.strip(),
        "chunk_type": "campus_overview",
        "chunk_id":   _chunk_id(f"campus_overview_{name}"),
    })

    # ── 2. Campus Departments ─────────────────────────────────────────────────
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
            **base_meta,
            "text":       text.strip(),
            "chunk_type": "campus_departments",
            "chunk_id":   _chunk_id(f"campus_departments_{name}"),
        })

    # ── 3. Campus Staff ───────────────────────────────────────────────────────
    staff = campus.get("staff", [])
    if staff:
        # Filter out entries with no real name
        valid_staff = [
            s for s in staff
            if s.get("name", "").strip()
            and s["name"].strip().lower() not in {"0", "", "null"}
        ]

        if valid_staff:
            staff_lines = []
            for s in valid_staff:
                email = _clean_email(s.get("email"))
                line  = f"  - {s['name']} | {s.get('title', 'N/A')}"
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
                **base_meta,
                "text":       text.strip(),
                "chunk_type": "campus_staff",
                "chunk_id":   _chunk_id(f"campus_staff_{name}"),
            })

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_json(data: Dict) -> List[Dict]:
    """
    Parse the full JSON and return a flat list of chunk dicts.
    Each dict has: text + all metadata fields.
    """
    chunks: List[Dict] = []

    # 1 — University overview
    chunks.append(build_university_overview(data))
    log.debug("  + university_overview")

    # 2 — Facilities
    facility_chunks = build_facility_chunks(data)
    chunks.extend(facility_chunks)
    log.debug(f"  + {len(facility_chunks)} facility chunks")

    # 3 — Campuses
    campus_count  = 0
    for campus in data.get("campuses", []):
        campus_chunks = build_campus_chunks(campus)
        chunks.extend(campus_chunks)
        campus_count += 1
    log.debug(f"  + {campus_count} campuses → {3 * campus_count} campus chunks (approx)")

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
        "is_campus_chunk":    chunk["chunk_type"].startswith("campus_"),
        "is_facility_chunk":  chunk["chunk_type"] == "facility",
        "is_overview_chunk":  chunk["chunk_type"] == "university_overview",

        # ── Campus metadata (empty string for non-campus chunks) ──────────────
        "campus_name":        chunk.get("campus_name", ""),
        "campus_city":        chunk.get("campus_city", ""),
        "campus_is_lahore":   chunk.get("campus_is_lahore", False),

        # ── Facility metadata (empty string for non-facility chunks) ──────────
        "facility_type":      chunk.get("facility_type", ""),

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

    parser = argparse.ArgumentParser(description="About-University Pinecone ingestion")
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
    log.info(f"About-University Ingestion")
    log.info(f"Source  : {JSON_FILE.name}")
    log.info(f"NS      : {PINECONE_NS}")
    log.info(f"Dry-run : {args.dry_run}")
    log.info(f"{'='*60}\n")

    # ── Parse JSON into chunks ────────────────────────────────────────────────
    raw_chunks = parse_json(data)
    log.info(f"Parsed {len(raw_chunks)} chunks:")

    # Print chunk inventory
    from collections import Counter
    counts = Counter(c["chunk_type"] for c in raw_chunks)
    for ctype, n in sorted(counts.items()):
        log.info(f"  {ctype:<25} {n}")

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