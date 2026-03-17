"""
fee_ingestion.py
================
Ingestion pipeline for fee_information.json
into Pinecone namespace: about-university  (same index: uoeaiassistant)

FILE BUG NOTE:
  The source JSON is two separate arrays concatenated — the file ends
  with ] then immediately starts a new [ on the next line. Standard
  json.load() will crash on this. This code handles it by splitting
  the raw text and parsing each array independently, then merging.

CHUNK DESIGN:
─────────────────────────────────────────────────────────────────────
  program_fee       → ONE chunk per program (Morning + Evening merged)
                      A user asking "What is the fee for BS CS?" needs
                      BOTH shifts in one result. Storing them separately
                      risks returning only one shift and missing the other.

  administrative_fee → ONE chunk for all one-time admin fees
                      (repeat course, migration, examination, verification,
                       degree, transcript, NOC, corrections, forms).
                      These are always asked together: "What are the
                      admin fees at UE?"

  additional_fee    → ONE chunk per level (MPhil/MS, PhD) for
                      thesis/comprehensive exam fees that are charged
                      separately from semester fees.

  policy            → ONE chunk for fee policy notes
                      (10% increase, hostel revision, general disclaimer).
─────────────────────────────────────────────────────────────────────

METADATA SCHEMA:
  namespace           → "about-university"
  chunk_type          → program_fee | administrative_fee |
                        additional_fee | policy
  program             → exact program name (program_fee chunks)
  level               → Undergraduate | Postgraduate | Doctorate |
                        Administrative | Policy
  shift               → Morning | Evening | Both
  semester_1_fee_morning  → int (0 if not applicable)
  semester_1_fee_evening  → int (0 if not applicable)
  semester_2_fee_morning  → int (0 if not applicable)
  semester_2_fee_evening  → int (0 if not applicable)
  is_post_adp         → bool
  is_postgraduate     → bool
  is_phd              → bool
  source_file         → filename
  chunk_id            → stable unique identifier
  text                → full chunk text
  text_preview        → first 200 chars

Usage:
  python fee_ingestion.py
  python fee_ingestion.py --dry-run
"""

import os
import re
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple
from datetime import datetime
from collections import defaultdict

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
    "/Data/About/fee_information.json"
)

LOG_FILE  = Path("fee_ingestion.log")

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
# JSON LOADER — handles the two-array concatenation bug in the source file
# ─────────────────────────────────────────────────────────────────────────────

def load_fee_json(path: Path) -> List[Dict]:
    """
    Load fee_information.json.

    The file contains two JSON arrays written back-to-back:
        [ ...entries... ]
        [ ...more entries... ]

    json.load() raises JSONDecodeError on this. We split on the
    boundary ]\\n[ (or ][ with optional whitespace) and parse each
    array separately, then return a flat merged list.
    """
    raw = path.read_text(encoding="utf-8").strip()

    # Find the boundary between the two arrays: ]  whitespace  [
    # Replace it with a comma to turn them into one valid array
    fixed = re.sub(r'\]\s*\[', ', ', raw, count=1)

    try:
        entries = json.loads(fixed)
        log.info(f"Loaded {len(entries)} fee entries from {path.name}")
        return entries
    except json.JSONDecodeError as e:
        log.error(f"JSON parse failed even after fix attempt: {e}")
        raise


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _chunk_id(label: str) -> str:
    return "fee_" + hashlib.md5(label.encode("utf-8")).hexdigest()[:14]


def _is_post_adp(program: str) -> bool:
    return bool(re.search(r"post.?adp", program, re.IGNORECASE))


def _is_postgraduate(level: str) -> bool:
    return bool(re.search(r"postgraduate|masters|mphil|ms\b|mba", level, re.IGNORECASE))


def _is_phd(level: str, program: str) -> bool:
    return bool(re.search(r"phd|doctorate|doctoral", level + " " + program, re.IGNORECASE))


def _fmt_fee(amount: int) -> str:
    """Format integer fee as Rs. XX,XXX"""
    return f"Rs. {amount:,}"


# ─────────────────────────────────────────────────────────────────────────────
# CHUNK BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_program_fee_chunks(entries: List[Dict]) -> List[Dict]:
    """
    Group Morning + Evening entries by program name into one chunk each.

    Why merged: a query "What is the fee for BS Computer Science?" must
    return both shifts. Two separate vectors means the retriever might
    only surface one shift and the answer looks incomplete.
    """
    # Group entries that have a 'program' key and fee amounts
    program_groups: Dict[str, Dict] = defaultdict(lambda: {
        "morning": None,
        "evening": None,
        "level": "",
        "content_lines": [],
    })

    for entry in entries:
        meta = entry.get("metadata", {})
        program = meta.get("program", "").strip()
        shift   = meta.get("shift", "").strip()
        level   = meta.get("level", "").strip()

        # Skip entries that are not program-fee rows
        if not program or "semester_1_fee" not in meta:
            continue

        grp = program_groups[program]
        grp["level"] = level

        fee_data = {
            "semester_1": meta.get("semester_1_fee", 0),
            "semester_2": meta.get("semester_2_fee", 0),
            "note":       "",
        }

        # Capture any note in the content (e.g. "Thesis fee charged separately")
        content = entry.get("content", "")
        note_match = re.search(
            r"(thesis fee[^.]+\.|will be charged separately\.)",
            content, re.IGNORECASE
        )
        if note_match:
            fee_data["note"] = note_match.group(0).strip()

        if shift.lower() == "morning":
            grp["morning"] = fee_data
        elif shift.lower() == "evening":
            grp["evening"] = fee_data

    # Build one chunk per program
    chunks: List[Dict] = []

    for program, grp in program_groups.items():
        level   = grp["level"]
        morning = grp["morning"]
        evening = grp["evening"]

        lines = [
            f"Fee Structure | {program}",
            "",
            f"Program: {program}",
            f"Level: {level}",
            "",
        ]

        s1_morning = s2_morning = s1_evening = s2_evening = 0

        if morning:
            s1_morning = morning["semester_1"]
            s2_morning = morning["semester_2"]
            lines.append(f"Morning Shift:")
            lines.append(f"  1st Semester Fee: {_fmt_fee(s1_morning)}")
            lines.append(f"  2nd Semester Fee: {_fmt_fee(s2_morning)}")
            if morning["note"]:
                lines.append(f"  Note: {morning['note']}")

        if evening:
            s1_evening = evening["semester_1"]
            s2_evening = evening["semester_2"]
            if morning:
                lines.append("")
            lines.append(f"Evening Shift:")
            lines.append(f"  1st Semester Fee: {_fmt_fee(s1_evening)}")
            lines.append(f"  2nd Semester Fee: {_fmt_fee(s2_evening)}")
            if evening["note"]:
                lines.append(f"  Note: {evening['note']}")

        text = "\n".join(lines)

        chunks.append({
            "text":                  text.strip(),
            "chunk_type":            "program_fee",
            "program":               program,
            "level":                 level,
            "shift":                 "Both" if (morning and evening)
                                     else ("Morning" if morning else "Evening"),
            "semester_1_fee_morning": s1_morning,
            "semester_2_fee_morning": s2_morning,
            "semester_1_fee_evening": s1_evening,
            "semester_2_fee_evening": s2_evening,
            "is_post_adp":           _is_post_adp(program),
            "is_postgraduate":       _is_postgraduate(level),
            "is_phd":                _is_phd(level, program),
            "chunk_id":              _chunk_id(f"program_fee_{program}"),
        })

    return chunks


def build_administrative_fee_chunk(entries: List[Dict]) -> List[Dict]:
    """
    Collect ALL one-time administrative fees into one single chunk.

    These are always asked together ("What are the misc fees at UE?")
    so they belong in one vector.
    """
    admin_lines   = ["Administrative and Miscellaneous Fees | University of Education", ""]
    general_lines = []
    cert_lines    = []
    record_lines  = []
    noc_lines     = []
    correction_lines = []
    form_lines    = []

    for entry in entries:
        meta     = entry.get("metadata", {})
        fee_type = meta.get("fee_type", "")
        content  = entry.get("content", "")

        if fee_type == "Administrative" and "re_admission_fee" in meta:
            # The admin fees from the second array (repeat course, migration, exam)
            general_lines += [
                "General Administrative Fees:",
                f"  Repeat / Additional Course: Rs. 2,000 per credit hour",
                f"  Migration Fee: Rs. 6,000",
                f"  Examination Fee: Rs. 4,000",
                f"  Re-Admission Fee: Rs. 2,500",
                f"  Transcript Fee: Rs. 1,000",
                f"  Duplicate ID Card: Rs. 500",
            ]

        elif fee_type == "Certification/Degree":
            cert_lines += [
                "Certification and Degree Fees:",
                f"  Verification (Normal): Rs. 2,500",
                f"  Verification (Urgent): Rs. 3,500",
                f"  Degree Before Convocation: Rs. 3,000",
                f"  Duplicate Degree: Rs. 4,000",
                f"  Language Proficiency / Other Certificate: Rs. 1,000",
            ]

        elif fee_type == "Academic Records":
            record_lines += [
                "Academic Records Fees:",
                f"  Provisional Transcript: Rs. 500",
                f"  Standard Transcript: Rs. 1,000",
                f"  Roll Number Correction: Rs. 2,000",
                f"  Re-checking Fee: Rs. 2,000 per paper",
            ]

        elif fee_type == "Registration/NOC":
            noc_lines += [
                "NOC and Registration Fees:",
                f"  NOC (Ordinary): Rs. 1,500",
                f"  NOC (Urgent): Rs. 2,000",
                f"  Duplicate Registration / Student ID Card: Rs. 500",
                f"  Registration Card Correction (after 60 days): Rs. 1,000",
            ]

        elif fee_type == "Corrections":
            correction_lines += [
                "Correction Fees:",
                f"  Name / Particulars Correction: Rs. 1,500",
                f"  Degree Correction: Rs. 2,500",
                f"  Syllabus Attestation: Rs. 1,000",
            ]

        elif fee_type == "Forms":
            form_lines += [
                "University Forms:",
                f"  Admission, NOC, Migration, Re-checking, Verification,"
                f" and Degree forms: NIL (no charge)",
            ]

    # Assemble all sections
    for section in [general_lines, cert_lines, record_lines,
                    noc_lines, correction_lines, form_lines]:
        if section:
            admin_lines.extend(section)
            admin_lines.append("")

    text = "\n".join(admin_lines).strip()

    if len(text) < 100:
        return []

    return [{
        "text":          text,
        "chunk_type":    "administrative_fee",
        "program":       "",
        "level":         "Administrative",
        "shift":         "",
        "semester_1_fee_morning": 0,
        "semester_2_fee_morning": 0,
        "semester_1_fee_evening": 0,
        "semester_2_fee_evening": 0,
        "is_post_adp":   False,
        "is_postgraduate": False,
        "is_phd":        False,
        "chunk_id":      _chunk_id("administrative_fees_all"),
    }]


def build_additional_fee_chunks(entries: List[Dict]) -> List[Dict]:
    """
    One chunk per postgraduate level for thesis / comprehensive exam fees.
    These are separate from semester fees and often asked independently:
    "How much is the thesis fee for MPhil?"
    """
    chunks: List[Dict] = []

    for entry in entries:
        meta     = entry.get("metadata", {})
        fee_type = meta.get("fee_type", "")

        if fee_type == "MPhil/MS Program Specific":
            text = (
                "Additional Fees | MPhil / MS Programs\n\n"
                "These fees are charged separately from semester fees:\n"
                f"  Comprehensive Examination Fee: Rs. 5,000 (charged at time of exam)\n"
                f"  Thesis Fee: Rs. 20,000\n"
                f"  Thesis Re-evaluation Fee: Rs. 100,000 (where applicable)"
            )
            chunks.append({
                "text":          text,
                "chunk_type":    "additional_fee",
                "program":       "MS / MPhil",
                "level":         "Postgraduate (Masters/MPhil)",
                "shift":         "",
                "semester_1_fee_morning": 0,
                "semester_2_fee_morning": 0,
                "semester_1_fee_evening": 0,
                "semester_2_fee_evening": 0,
                "is_post_adp":   False,
                "is_postgraduate": True,
                "is_phd":        False,
                "chunk_id":      _chunk_id("additional_fee_mphil_ms"),
            })

        elif fee_type == "PhD Program Specific":
            text = (
                "Additional Fees | PhD Programs\n\n"
                "These fees are charged separately from semester fees:\n"
                f"  Comprehensive Examination Fee: Rs. 5,000 (charged at time of exam)\n"
                f"  Thesis Evaluation Fee: Rs. 100,000"
            )
            chunks.append({
                "text":          text,
                "chunk_type":    "additional_fee",
                "program":       "PhD",
                "level":         "Doctorate",
                "shift":         "",
                "semester_1_fee_morning": 0,
                "semester_2_fee_morning": 0,
                "semester_1_fee_evening": 0,
                "semester_2_fee_evening": 0,
                "is_post_adp":   False,
                "is_postgraduate": False,
                "is_phd":        True,
                "chunk_id":      _chunk_id("additional_fee_phd"),
            })

    return chunks


def build_policy_chunk(entries: List[Dict]) -> List[Dict]:
    """
    One chunk for all fee policy statements:
    10% increase, hostel revision, general disclaimer.
    These answer questions like "Was there a fee increase?" or
    "Can fees change without notice?"
    """
    policy_lines = ["Fee Policy and General Notes | University of Education", ""]

    for entry in entries:
        meta     = entry.get("metadata", {})
        content  = entry.get("content", "").strip()

        fee_type = meta.get("fee_type", "")
        note     = meta.get("note", "")

        if fee_type == "Academic Programs" and "increase_percentage" in meta:
            policy_lines.append(
                f"Fee Increase: {meta['increase_percentage']} increase in all academic "
                f"program fees approved (added to tuition fee only). "
                f"Effective from: {meta.get('effective_date', 'Fall-2022')}."
            )

        elif fee_type == "Hostel":
            policy_lines.append(
                "Hostel Fees: Syndicate approved revision to hostel fee heads "
                "(Accommodation, Miscellaneous, Hostel Security). "
                "Internet charges for hostel students have been waived."
            )

        elif note == "General":
            policy_lines.append(content)

    text = "\n".join(policy_lines).strip()

    if len(text) < 50:
        return []

    return [{
        "text":          text,
        "chunk_type":    "policy",
        "program":       "",
        "level":         "Policy",
        "shift":         "",
        "semester_1_fee_morning": 0,
        "semester_2_fee_morning": 0,
        "semester_1_fee_evening": 0,
        "semester_2_fee_evening": 0,
        "is_post_adp":   False,
        "is_postgraduate": False,
        "is_phd":        False,
        "chunk_id":      _chunk_id("fee_policy_general"),
    }]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_fee_data(entries: List[Dict]) -> List[Dict]:
    chunks: List[Dict] = []

    program_chunks = build_program_fee_chunks(entries)
    chunks.extend(program_chunks)
    log.info(f"  + {len(program_chunks)} program_fee chunks")

    admin_chunks = build_administrative_fee_chunk(entries)
    chunks.extend(admin_chunks)
    log.info(f"  + {len(admin_chunks)} administrative_fee chunks")

    additional_chunks = build_additional_fee_chunks(entries)
    chunks.extend(additional_chunks)
    log.info(f"  + {len(additional_chunks)} additional_fee chunks")

    policy_chunks = build_policy_chunk(entries)
    chunks.extend(policy_chunks)
    log.info(f"  + {len(policy_chunks)} policy chunks")

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# METADATA FINALIZER
# ─────────────────────────────────────────────────────────────────────────────

def finalize_metadata(chunk: Dict, chunk_index: int, total: int) -> Dict:
    text = chunk["text"]
    text_safe = text.encode("utf-8")[:38_000].decode("utf-8", errors="ignore")

    return {
        # ── Identity ──────────────────────────────────────────────────────────
        "namespace":              PINECONE_NS,
        "source_file":            JSON_FILE.name,
        "chunk_id":               chunk["chunk_id"],
        "chunk_index":            chunk_index,
        "total_chunks":           total,

        # ── Classification ────────────────────────────────────────────────────
        "chunk_type":             chunk["chunk_type"],
        "is_program_fee":         chunk["chunk_type"] == "program_fee",
        "is_administrative_fee":  chunk["chunk_type"] == "administrative_fee",
        "is_additional_fee":      chunk["chunk_type"] == "additional_fee",
        "is_policy":              chunk["chunk_type"] == "policy",

        # ── Program metadata ──────────────────────────────────────────────────
        "program":                chunk.get("program", ""),
        "level":                  chunk.get("level", ""),
        "shift":                  chunk.get("shift", ""),

        # ── Fee amounts (filterable) ───────────────────────────────────────────
        "semester_1_fee_morning": chunk.get("semester_1_fee_morning", 0),
        "semester_2_fee_morning": chunk.get("semester_2_fee_morning", 0),
        "semester_1_fee_evening": chunk.get("semester_1_fee_evening", 0),
        "semester_2_fee_evening": chunk.get("semester_2_fee_evening", 0),

        # ── Program type flags ────────────────────────────────────────────────
        "is_post_adp":            chunk.get("is_post_adp", False),
        "is_postgraduate":        chunk.get("is_postgraduate", False),
        "is_phd":                 chunk.get("is_phd", False),

        # ── Content ───────────────────────────────────────────────────────────
        "chunk_length":           len(text),
        "text_preview":           text[:200].strip(),
        "text":                   text_safe,

        # ── Timestamp ─────────────────────────────────────────────────────────
        "ingested_at":            datetime.now().isoformat(),
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

    parser = argparse.ArgumentParser(description="Fee information Pinecone ingestion")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and embed only — no Pinecone upsert")
    args = parser.parse_args()

    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")

    if not JSON_FILE.exists():
        raise FileNotFoundError(f"JSON file not found: {JSON_FILE}")

    log.info(f"\n{'='*60}")
    log.info(f"Fee Information Ingestion")
    log.info(f"Source   : {JSON_FILE.name}")
    log.info(f"Index    : {PINECONE_INDEX}")
    log.info(f"NS       : {PINECONE_NS}")
    log.info(f"Dry-run  : {args.dry_run}")
    log.info(f"{'='*60}\n")

    # ── Load + parse ──────────────────────────────────────────────────────────
    entries    = load_fee_json(JSON_FILE)
    raw_chunks = parse_fee_data(entries)

    log.info(f"\nTotal chunks: {len(raw_chunks)}")

    metas = [
        finalize_metadata(chunk, i, len(raw_chunks))
        for i, chunk in enumerate(raw_chunks)
    ]

    # ── Pinecone + OpenAI setup ───────────────────────────────────────────────
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
            spec      = __import__("pinecone").ServerlessSpec(
                cloud=PINECONE_CLOUD, region=PINECONE_REGION
            ),
        )
        import time; time.sleep(10)

    index = pc.Index(PINECONE_INDEX)

    embedder = OpenAIEmbeddings(
        model          = OPENAI_MODEL,
        openai_api_key = os.getenv("OPENAI_API_KEY"),
    )

    # ── Embed + upsert ────────────────────────────────────────────────────────
    log.info(f"Embedding and upserting {len(metas)} vectors ...")
    n = embed_and_upsert(metas, index, embedder, dry_run=args.dry_run)

    log.info(f"\n{'='*60}")
    log.info(f"DONE")
    log.info(f"Vectors upserted : {n}")
    log.info(f"Namespace        : {PINECONE_NS}")
    log.info(f"{'='*60}\n")


if __name__ == "__main__":
    main()