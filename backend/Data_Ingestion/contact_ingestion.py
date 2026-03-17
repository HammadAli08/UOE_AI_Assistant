"""
contact_ingestion.py
=====================
Ingestion pipeline for contact_information.json
into Pinecone namespace: about-university  (index: uoeaiassistant)

CHUNK DESIGN (~33 vectors total):
─────────────────────────────────────────────────────────────────────
  individual_contact  → ONE chunk per person (28 total)
      Name + title + department + all contact details in one block.
      Answers: "What is the VC's email?", "How to contact the registrar?"
               "What is the phone number of the Controller of Exams?"

  contact_directory   → ONE chunk per category (5 total)
      All people in a category listed together.
      Answers: "Who handles student services at UE?"
               "List all campus principals and their contact details."
               "Who are the academic division directors?"

CATEGORIES IN DATA:
  university_administration → VC, Registrar, Treasurer, Directors, etc.
  student_services          → Student Affairs, Sports, Health, Counselling
  research                  → ORIC
  academic_affairs          → QEC, Financial Aid
  academic_division         → Division Directors (Science, Education, etc.)
  campus                    → Campus Principals
─────────────────────────────────────────────────────────────────────

METADATA SCHEMA:
  namespace           → "about-university"
  chunk_type          → individual_contact | contact_directory
  person_name         → full name
  person_title        → job title
  department          → office / department name
  category            → university_administration | student_services |
                        research | academic_affairs | academic_division | campus
  email               → email address (empty string if not available)
  phone               → primary phone
  has_email           → bool
  has_phone           → bool
  is_campus_contact   → bool
  is_senior_admin     → bool (VC, Registrar, Treasurer, Controller, Directors)
  source_file         → filename
  chunk_id            → stable unique identifier
  text                → full chunk text
  text_preview        → first 200 chars
"""

import os
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict
from collections import defaultdict
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

PINECONE_INDEX  = "uoeaiassistant"
PINECONE_NS     = "about-university"
PINECONE_DIM    = 3072
PINECONE_METRIC = "cosine"
PINECONE_CLOUD  = "aws"
PINECONE_REGION = "us-east-1"

OPENAI_MODEL    = "text-embedding-3-large"
EMBED_BATCH     = 20
UPSERT_BATCH    = 100

JSON_FILE = Path(
    "/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend"
    "/Data/About/contact_information.json"
)

LOG_FILE = Path("contact_ingestion.log")

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
# CATEGORY LABELS  — human-readable headings for directory chunks
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_LABELS = {
    "university_administration": "University Administration",
    "student_services":          "Student Services",
    "research":                  "Research (ORIC)",
    "academic_affairs":          "Academic Affairs",
    "academic_division":         "Academic Divisions",
    "campus":                    "Campus Principals",
}

# Titles considered senior administration
SENIOR_TITLES = {
    "vice chancellor", "registrar", "treasurer",
    "controller of examinations", "director", "additional director",
    "principal", "chief",
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _chunk_id(label: str) -> str:
    return "contact_" + hashlib.md5(label.encode("utf-8")).hexdigest()[:14]


def _clean(value) -> str:
    """Return empty string for None, 0, or missing values."""
    if value is None:
        return ""
    s = str(value).strip()
    return "" if s in {"0", "null", "none", ""} else s


def _is_senior(title: str) -> bool:
    t = title.lower()
    return any(s in t for s in SENIOR_TITLES)


def _format_contact_block(meta: Dict) -> str:
    """Build a clean contact detail block from metadata fields."""
    lines = []
    email = _clean(meta.get("email"))
    phone = _clean(meta.get("phone"))
    alt   = _clean(meta.get("alternate_phone"))
    fax   = _clean(meta.get("fax"))
    addr  = _clean(meta.get("address"))

    if email: lines.append(f"  Email   : {email}")
    if phone: lines.append(f"  Phone   : {phone}")
    if alt:   lines.append(f"  Alt Ph  : {alt}")
    if fax:   lines.append(f"  Fax     : {fax}")
    if addr:  lines.append(f"  Address : {addr}")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# CHUNK BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_individual_chunks(entries: List[Dict]) -> List[Dict]:
    """
    One chunk per person.
    Answers precise queries like "What is the VC's phone number?"
    or "How do I email the Controller of Examinations?"
    """
    chunks: List[Dict] = []

    for entry in entries:
        meta  = entry.get("metadata", {})
        name  = _clean(meta.get("name"))
        title = _clean(meta.get("title"))
        dept  = _clean(meta.get("department"))
        cat   = _clean(meta.get("category"))
        email = _clean(meta.get("email"))
        phone = _clean(meta.get("phone"))

        if not name:
            continue

        cat_label = CATEGORY_LABELS.get(cat, cat.replace("_", " ").title())

        # Build text — rich enough for both keyword and semantic retrieval
        lines = [
            f"Contact | {name}",
            f"University of Education, Lahore",
            "",
            f"Name       : {name}",
        ]
        if title: lines.append(f"Title      : {title}")
        if dept:  lines.append(f"Department : {dept}")
        lines.append(f"Category   : {cat_label}")
        lines.append("")
        lines.append("Contact Details:")

        contact_block = _format_contact_block(meta)
        if contact_block:
            lines.append(contact_block)
        else:
            lines.append("  No contact details available.")

        text = "\n".join(lines)

        chunks.append({
            "text":             text.strip(),
            "chunk_type":       "individual_contact",
            "person_name":      name,
            "person_title":     title,
            "department":       dept,
            "category":         cat,
            "email":            email,
            "phone":            phone,
            "has_email":        bool(email),
            "has_phone":        bool(phone),
            "is_campus_contact": cat == "campus",
            "is_senior_admin":  _is_senior(title),
            "chunk_id":         _chunk_id(f"individual_{name}"),
        })

    return chunks


def build_directory_chunks(entries: List[Dict]) -> List[Dict]:
    """
    One chunk per category — a compact directory listing.
    Answers "Who handles student services?" or
    "Give me all campus principals with their contacts."
    """
    # Group by category
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for entry in entries:
        cat = _clean(entry.get("metadata", {}).get("category"))
        if cat:
            groups[cat].append(entry)

    chunks: List[Dict] = []

    for cat, cat_entries in groups.items():
        cat_label = CATEGORY_LABELS.get(cat, cat.replace("_", " ").title())

        lines = [
            f"Contact Directory | {cat_label}",
            f"University of Education, Lahore",
            "",
            f"Category : {cat_label}",
            f"Total    : {len(cat_entries)} contacts",
            "",
        ]

        for entry in cat_entries:
            meta  = entry.get("metadata", {})
            name  = _clean(meta.get("name"))
            title = _clean(meta.get("title"))
            dept  = _clean(meta.get("department"))
            email = _clean(meta.get("email"))
            phone = _clean(meta.get("phone"))

            person_line = f"• {name}"
            if title: person_line += f" — {title}"
            if dept and dept != name: person_line += f" ({dept})"
            lines.append(person_line)

            if email: lines.append(f"    Email : {email}")
            if phone: lines.append(f"    Phone : {phone}")
            lines.append("")

        text = "\n".join(lines).strip()

        chunks.append({
            "text":             text,
            "chunk_type":       "contact_directory",
            "person_name":      "",
            "person_title":     "",
            "department":       "",
            "category":         cat,
            "email":            "",
            "phone":            "",
            "has_email":        False,
            "has_phone":        False,
            "is_campus_contact": cat == "campus",
            "is_senior_admin":  False,
            "chunk_id":         _chunk_id(f"directory_{cat}"),
        })

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_contacts(entries: List[Dict]) -> List[Dict]:
    chunks: List[Dict] = []

    individual = build_individual_chunks(entries)
    chunks.extend(individual)
    log.info(f"  + {len(individual)} individual_contact chunks")

    directory = build_directory_chunks(entries)
    chunks.extend(directory)
    log.info(f"  + {len(directory)} contact_directory chunks")

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# METADATA FINALIZER
# ─────────────────────────────────────────────────────────────────────────────

def finalize_metadata(chunk: Dict, chunk_index: int, total: int) -> Dict:
    text      = chunk["text"]
    text_safe = text.encode("utf-8")[:38_000].decode("utf-8", errors="ignore")

    return {
        # ── Identity ──────────────────────────────────────────────────────────
        "namespace":           PINECONE_NS,
        "source_file":         JSON_FILE.name,
        "chunk_id":            chunk["chunk_id"],
        "chunk_index":         chunk_index,
        "total_chunks":        total,

        # ── Classification ────────────────────────────────────────────────────
        "chunk_type":          chunk["chunk_type"],
        "is_individual":       chunk["chunk_type"] == "individual_contact",
        "is_directory":        chunk["chunk_type"] == "contact_directory",

        # ── Person metadata ───────────────────────────────────────────────────
        "person_name":         chunk.get("person_name", ""),
        "person_title":        chunk.get("person_title", ""),
        "department":          chunk.get("department", ""),
        "category":            chunk.get("category", ""),

        # ── Contact details (filterable) ──────────────────────────────────────
        "email":               chunk.get("email", ""),
        "phone":               chunk.get("phone", ""),
        "has_email":           chunk.get("has_email", False),
        "has_phone":           chunk.get("has_phone", False),

        # ── Type flags ────────────────────────────────────────────────────────
        "is_campus_contact":   chunk.get("is_campus_contact", False),
        "is_senior_admin":     chunk.get("is_senior_admin", False),

        # ── Content ───────────────────────────────────────────────────────────
        "chunk_length":        len(text),
        "text_preview":        text[:200].strip(),
        "text":                text_safe,

        # ── Timestamp ─────────────────────────────────────────────────────────
        "ingested_at":         datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# EMBED + UPSERT
# ─────────────────────────────────────────────────────────────────────────────

def embed_and_upsert(
    metas:   List[Dict],
    index,
    embedder,
    dry_run: bool = False,
) -> int:
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
            {"id": m["chunk_id"], "values": v, "metadata": m}
            for m, v in zip(batch_metas, vectors_raw)
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

    parser = argparse.ArgumentParser(description="Contact information Pinecone ingestion")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and embed only — no Pinecone upsert")
    args = parser.parse_args()

    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")

    if not JSON_FILE.exists():
        raise FileNotFoundError(f"JSON file not found: {JSON_FILE}")

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        entries = json.load(f)

    log.info(f"\n{'='*60}")
    log.info(f"Contact Information Ingestion")
    log.info(f"Source   : {JSON_FILE.name}")
    log.info(f"Index    : {PINECONE_INDEX}")
    log.info(f"NS       : {PINECONE_NS}")
    log.info(f"Entries  : {len(entries)}")
    log.info(f"Dry-run  : {args.dry_run}")
    log.info(f"{'='*60}\n")

    raw_chunks = parse_contacts(entries)
    log.info(f"Total chunks: {len(raw_chunks)}")

    metas = [
        finalize_metadata(chunk, i, len(raw_chunks))
        for i, chunk in enumerate(raw_chunks)
    ]

    # ── Pinecone + OpenAI ─────────────────────────────────────────────────────
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

    log.info(f"Embedding and upserting {len(metas)} vectors ...")
    n = embed_and_upsert(metas, index, embedder, dry_run=args.dry_run)

    log.info(f"\n{'='*60}")
    log.info(f"DONE")
    log.info(f"Vectors upserted : {n}")
    log.info(f"Namespace        : {PINECONE_NS}")
    log.info(f"{'='*60}\n")


if __name__ == "__main__":
    main()