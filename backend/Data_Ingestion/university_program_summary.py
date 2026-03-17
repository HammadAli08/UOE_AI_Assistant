"""
about_university_summaries_ingestion.py
========================================
Ingestion pipeline for about_university.json
into Pinecone namespace: about-university  (index: uoeaiassistant)

DATA ANALYSIS:
  ~100 entries. Each entry is an AI-generated summary of one PDF document
  (program scheme of studies or regulatory document) with fields:
    - id          : unique document identifier (some have trailing \n — cleaned)
    - source_file : original PDF filename    (some have trailing \n — cleaned)
    - summary     : multi-paragraph text summary

  PROBLEM 1 — REPETITIVE BOILERPLATE:
    Every summary contains the same 3 generic paragraphs about attendance
    policy, fee refunds, hostel, and shift changes. If ingested as-is, all
    100 vectors will score nearly equally on any general university query,
    making retrieval useless. Solution: prepend a strong program-identity
    prefix so the embedding is anchored to the specific program, not the
    boilerplate. The boilerplate is kept for keyword coverage but the
    program name appears first and is repeated.

  PROBLEM 2 — CORRUPT SUMMARY:
    bs-zoology-2023 has a summary starting mid-sentence with "as well as
    procedures for requesting shift changes...". Detected and flagged.

  PROBLEM 3 — DIRTY IDs / FILENAMES:
    "financial-assistance\n" and its source_file have trailing newlines.
    Stripped on load.

CHUNK DESIGN (~107 vectors):
─────────────────────────────────────────────────────────────────────
  program_summary    → ONE chunk per document entry (~100 total)
      Enriched with program name, type, and level as a prefix so the
      embedding is anchored to the program, not the generic boilerplate.
      Answers: "What is the BS Chemistry program about?"
               "What programs does UE offer in education?"
               "What are the PhD admission requirements?"

  category_digest    → ONE chunk per document category (7 total)
      A compact list of all programs/documents in that category with
      their key facts extracted from summaries.
      Answers: "What BS programs does UE offer?"
               "What regulatory documents govern UE students?"
               "What B.Ed programs are available?"

DOCUMENT CATEGORIES:
  bs_4year       → BS 4-year programs
  bs_2year       → BS 2-year programs
  bs_post_adp    → BS Post-ADP programs
  adp            → ADP programs
  bed            → B.Ed programs (all variants)
  bba_bfa        → BBA and BFA programs
  regulatory     → Regulations, rules, migration, PhD admission docs
  financial      → Financial assistance / scholarship documents
─────────────────────────────────────────────────────────────────────
"""

import os
import re
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple
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
    "/Data/About/about_university.json"
)

LOG_FILE = Path("about_university_summaries_ingestion.log")

# Minimum characters for a summary to be considered valid
MIN_SUMMARY_CHARS = 100

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
# CATEGORY LABELS
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_LABELS = {
    "bs_4year":    "BS Programs (4 Years)",
    "bs_2year":    "BS Programs (2 Years)",
    "bs_post_adp": "BS Programs (Post ADP)",
    "adp":         "Associate Degree Programs (ADP)",
    "bed":         "B.Ed Programs",
    "bba_bfa":     "BBA and BFA Programs",
    "ms_phd":      "MS, MPhil, MA, MSc and PhD Programs",
    "regulatory":  "University Regulations and Policies",
    "financial":   "Financial Assistance and Scholarships",
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _chunk_id(label: str) -> str:
    return "about_" + hashlib.md5(label.encode("utf-8")).hexdigest()[:14]


def _clean_str(value: str) -> str:
    """Strip whitespace, newlines, and null-like values."""
    if not value:
        return ""
    return value.strip().replace("\n", " ").replace("\r", "").strip()


def _is_corrupt_summary(summary: str) -> bool:
    """
    Detect summaries that are unusable:
    - Start mid-sentence (corrupt extraction)
    - LLM refusals ("I'm sorry, but I can't assist with that.")
    - Too short to be meaningful
    """
    if not summary:
        return True
    s = summary.strip()
    if len(s) < MIN_SUMMARY_CHARS:
        return True
    # LLM refusal patterns — must skip entirely
    refusal_patterns = [
        r"^i'm sorry",
        r"^i am sorry",
        r"^i cannot assist",
        r"^i can't assist",
        r"^i'm unable",
        r"^sorry, (but )?i",
    ]
    for p in refusal_patterns:
        if re.match(p, s, re.IGNORECASE):
            return True
    # Starts mid-sentence indicators
    lower_start = re.match(r'^[a-z]', s)
    mid_phrase  = re.match(
        r'^(as well as|and |or |but |however|with |of |in |at |to )',
        s, re.IGNORECASE
    )
    return bool(lower_start or mid_phrase)


def _is_llm_refusal(summary: str) -> bool:
    """Specifically detect LLM refusal responses — these must be fully skipped."""
    if not summary:
        return False
    s = summary.strip()
    patterns = [
        r"i'm sorry.*can't assist",
        r"i am sorry.*cannot",
        r"i cannot assist",
        r"i can't assist",
        r"i'm unable to",
    ]
    for p in patterns:
        if re.search(p, s, re.IGNORECASE):
            return True
    return False


def _program_name_from_source(source_file: str) -> str:
    """
    Extract a clean program name from the source filename.
    Examples:
      "BS Computer Science (2023).pdf"             → "BS Computer Science"
      "4-BFA (Graphic Design) (2023).pdf"          → "BFA (Graphic Design)"
      "B.Ed. (2.5 Years) Special Education (Post ADP) (2023).pdf"
                                                   → "B.Ed. (2.5 Years) Special Education (Post ADP)"
      "General Regulations 2022 regarding Undergraduate....pdf"
                                                   → "General Regulations 2022"
    """
    name = source_file
    # Remove .pdf extension
    name = re.sub(r'\.pdf$', '', name, flags=re.IGNORECASE).strip()
    # Remove leading number prefix like "4-", "12-", "9-"
    name = re.sub(r'^\d+[-\s]+', '', name)
    # Remove standalone year tokens like (2022) (2023) (2024) (2025)
    name = re.sub(r'\(\s*20\d{2}\s*\)', '', name)
    # Remove "Revised in 20XX"
    name = re.sub(r'\(?\s*Revised\s+in\s+20\d{2}\s*\)?', '', name, flags=re.IGNORECASE)
    # Collapse whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    # Remove trailing parentheses artifacts like "( )" or "( 2 Years )"
    name = re.sub(r'\(\s*\)', '', name).strip()
    return name[:120]


def _classify_document(source_file: str, doc_id: str) -> str:
    """
    Determine which category a document belongs to.
    Returns one of the CATEGORY_LABELS keys.

    ORDER MATTERS — most specific patterns first, broad fallbacks last.
    """
    sf  = source_file.lower()
    did = doc_id.lower()
    combined = sf + " " + did

    # ── Regulatory documents — must match on filename keywords ────────────────
    regulatory_keywords = [
        r'general.?regulation', r'migration.?regulation',
        r'discipline.*conduct', r'conduct.*discipline',
        r'hostel.*regulation', r'hostel.*admission',
        r'admission.*examination.*regulation',
        r'phd.*admission.*regulation',
        r'teacher.*handbook', r'student.*handbook',
        r'annexure.*admission', r'financial.*assistance',
    ]
    for kw in regulatory_keywords:
        if re.search(kw, combined):
            # Financial assistance is its own category
            if re.search(r'financial.*assist|scholarship', combined):
                return "financial"
            return "regulatory"

    # ── Financial ─────────────────────────────────────────────────────────────
    if re.search(r'financial.*assist|scholarship|financial.*aid', combined):
        return "financial"

    # ── BFA ───────────────────────────────────────────────────────────────────
    if re.search(r'\bbfa\b|bachelor.*fine.*arts|graphic.*design|painting', combined):
        return "bba_bfa"

    # ── BBA ───────────────────────────────────────────────────────────────────
    if re.search(r'\bbba\b', combined):
        return "bba_bfa"

    # ── B.Ed (before BS check to avoid BS matching inside B.Ed filenames) ─────
    if re.search(r'\bb\.?ed\b|b\.ed\.|b\.?ed\s', combined):
        return "bed"

    # ── ADP (standalone, not Post-ADP) ────────────────────────────────────────
    if re.search(r'\badp\b', combined) and not re.search(r'post.?adp', combined):
        return "adp"

    # ── BS Post-ADP ───────────────────────────────────────────────────────────
    if re.search(r'post.?adp', combined):
        return "bs_post_adp"

    # ── BS 2-year ─────────────────────────────────────────────────────────────
    if re.search(r'\bbs\b.*2.?year|2.?year.*\bbs\b', combined):
        return "bs_2year"

    # ── BS 4-year ─────────────────────────────────────────────────────────────
    if re.search(r'\bbs\b', combined):
        return "bs_4year"

    # ── MS / MPhil / PhD / MA / MSc ───────────────────────────────────────────
    if re.search(
        r'\bms\b|\bmphil\b|m\.phil|m\.?phil|'
        r'\bphd\b|ph\.d|doctoral|'
        r'\bma\b|\bmsc\b|m\.sc|master',
        combined
    ):
        return "ms_phd"

    # ── Fallback: remaining docs are likely regulations/handbooks ─────────────
    return "regulatory"


def _extract_program_type(source_file: str) -> str:
    """Return a short program type label."""
    sf = source_file.lower()
    if re.search(r'\bphd\b|doctoral', sf):            return "PhD"
    if re.search(r'\bms\b|mphil|master', sf):         return "MS/MPhil"
    if re.search(r'\bbba\b', sf):                     return "BBA"
    if re.search(r'\bbfa\b', sf):                     return "BFA"
    if re.search(r'\bb\.?ed\b', sf):                  return "B.Ed."
    if re.search(r'\badp\b', sf):                     return "ADP"
    if re.search(r'\bbs\b', sf):                      return "BS"
    return "University Document"


def _extract_key_disciplines(summary: str) -> str:
    """
    Extract the first sentence mentioning specific disciplines/programs
    from a summary — used to enrich category digest chunks.
    """
    # Find sentences that mention specific disciplines
    sentences = re.split(r'(?<=[.!?])\s+', summary)
    for sent in sentences[:3]:
        if re.search(
            r'\b(Computer Science|Chemistry|Physics|Mathematics|History|'
            r'English|Urdu|Zoology|Botany|Business|Education|Economics|'
            r'Islamic|Pakistan Studies|Public Admin|Fine Arts|Information Tech|'
            r'Graphic Design|Painting|Special Education)\b',
            sent
        ):
            return sent.strip()[:300]
    return sentences[0].strip()[:300] if sentences else ""

# ─────────────────────────────────────────────────────────────────────────────
# CHUNK BUILDERS
# ─────────────────────────────────────────────────────────────────────────────

def build_program_summary_chunks(entries: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """
    Build one chunk per valid document entry.

    The embedding anchor problem:
      Without a strong prefix, all summaries embed to nearly the same
      vector because they share 70%+ boilerplate text. The prefix forces
      the embedding to be anchored to the specific program name.

    Prefix format:
      Program Summary | BS Computer Science | BS | bs_4year
      University of Education, Lahore
      Source Document: BS Computer Science (2023).pdf

    Returns (valid_chunks, skipped_entries_info)
    """
    chunks:  List[Dict] = []
    skipped: List[Dict] = []

    for entry in entries:
        doc_id      = _clean_str(entry.get("id", ""))
        source_file = _clean_str(entry.get("source_file", ""))
        summary     = entry.get("summary", "")

        if not doc_id or not source_file:
            log.warning(f"Skipping entry with missing id or source_file")
            skipped.append({"id": doc_id, "reason": "missing id or source_file"})
            continue

        summary = summary.strip() if summary else ""

        # ── LLM refusal: skip entirely — do not ingest ────────────────────────
        if _is_llm_refusal(summary):
            log.warning(f"LLM REFUSAL detected — skipping entirely: [{doc_id}]")
            skipped.append({"id": doc_id, "reason": "LLM refusal response",
                            "preview": summary[:80]})
            continue

        # ── Corrupt/truncated summary: ingest with warning note ───────────────
        corrupt = _is_corrupt_summary(summary)
        if corrupt:
            log.warning(f"Corrupt/truncated summary: [{doc_id}]")
            skipped.append({"id": doc_id, "reason": "corrupt or truncated summary",
                            "preview": summary[:80]})
            summary = (
                f"[Note: The extracted summary for this document is incomplete. "
                f"Source document: {source_file}. "
                f"Partial content follows:]\n\n"
                + summary
            )

        program_name = _program_name_from_source(source_file)
        category     = _classify_document(source_file, doc_id)
        program_type = _extract_program_type(source_file)
        cat_label    = CATEGORY_LABELS.get(category, category)

        text = (
            f"Program Summary | {program_name}\n"
            f"University of Education, Lahore\n"
            f"Program Type: {program_type} | Category: {cat_label}\n"
            f"Source Document: {source_file}\n\n"
            f"{summary}"
        )

        chunks.append({
            "text":           text.strip(),
            "chunk_type":     "program_summary",
            "document_id":    doc_id,
            "program_name":   program_name,
            "program_type":   program_type,
            "category":       category,
            "source_document": source_file,
            "is_corrupt":     corrupt,
            "chunk_id":       _chunk_id(f"prog_summary_{doc_id}"),
        })

    return chunks, skipped


def build_category_digest_chunks(entries: List[Dict]) -> List[Dict]:
    """
    One chunk per category — a compact directory of all programs in that
    category with a one-line description extracted from each summary.

    These answer: "What BS programs does UE offer?" or
    "What regulatory documents govern UE?"
    """
    # Group valid entries by category
    groups: Dict[str, List[Dict]] = defaultdict(list)
    for entry in entries:
        source_file = _clean_str(entry.get("source_file", ""))
        doc_id      = _clean_str(entry.get("id", ""))
        summary     = (entry.get("summary") or "").strip()

        if not source_file or not summary:
            continue

        cat = _classify_document(source_file, doc_id)
        groups[cat].append({
            "name":    _program_name_from_source(source_file),
            "type":    _extract_program_type(source_file),
            "snippet": _extract_key_disciplines(summary),
            "source":  source_file,
        })

    chunks: List[Dict] = []

    for cat, items in groups.items():
        # Sort alphabetically by program name
        items.sort(key=lambda x: x["name"])
        cat_label = CATEGORY_LABELS.get(cat, cat.replace("_", " ").title())

        lines = [
            f"Programs Directory | {cat_label}",
            f"University of Education, Lahore",
            "",
            f"Category : {cat_label}",
            f"Total    : {len(items)} programs/documents",
            "",
        ]

        for item in items:
            lines.append(f"• {item['name']}  [{item['type']}]")
            if item["snippet"]:
                # Indent the snippet for readability
                lines.append(f"    {item['snippet'][:200]}")
            lines.append("")

        text = "\n".join(lines).strip()

        chunks.append({
            "text":          text,
            "chunk_type":    "category_digest",
            "document_id":   "",
            "program_name":  "",
            "program_type":  "",
            "category":      cat,
            "source_document": "",
            "is_corrupt":    False,
            "chunk_id":      _chunk_id(f"category_digest_{cat}"),
        })

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────────────────────────────

def parse_about_data(entries: List[Dict]) -> List[Dict]:
    """Parse all entries and return flat list of chunk dicts."""
    chunks: List[Dict] = []

    prog_chunks, skipped = build_program_summary_chunks(entries)
    chunks.extend(prog_chunks)
    log.info(f"  + {len(prog_chunks)} program_summary chunks")

    if skipped:
        log.warning(f"  ! {len(skipped)} entries had issues:")
        for s in skipped:
            log.warning(f"      [{s['id']}] {s['reason']}"
                        + (f" — preview: {s.get('preview','')}" if 'preview' in s else ""))

    cat_chunks = build_category_digest_chunks(entries)
    chunks.extend(cat_chunks)
    log.info(f"  + {len(cat_chunks)} category_digest chunks")

    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# METADATA FINALIZER
# ─────────────────────────────────────────────────────────────────────────────

def finalize_metadata(chunk: Dict, chunk_index: int, total: int) -> Dict:
    text      = chunk["text"]
    text_safe = text.encode("utf-8")[:38_000].decode("utf-8", errors="ignore")
    category  = chunk.get("category", "")

    return {
        # ── Identity ──────────────────────────────────────────────────────────
        "namespace":       PINECONE_NS,
        "source_file":     JSON_FILE.name,
        "chunk_id":        chunk["chunk_id"],
        "chunk_index":     chunk_index,
        "total_chunks":    total,

        # ── Classification ────────────────────────────────────────────────────
        "chunk_type":      chunk["chunk_type"],
        "is_program_summary":  chunk["chunk_type"] == "program_summary",
        "is_category_digest":  chunk["chunk_type"] == "category_digest",

        # ── Document identity ─────────────────────────────────────────────────
        "document_id":     chunk.get("document_id", ""),
        "program_name":    chunk.get("program_name", ""),
        "program_type":    chunk.get("program_type", ""),
        "source_document": chunk.get("source_document", ""),

        # ── Category ──────────────────────────────────────────────────────────
        "category":        category,
        "category_label":  CATEGORY_LABELS.get(category, ""),

        # ── Program type flags (for metadata filtering) ───────────────────────
        "is_bs":           category in ("bs_4year", "bs_2year", "bs_post_adp"),
        "is_bs_4year":     category == "bs_4year",
        "is_bs_2year":     category == "bs_2year",
        "is_bs_post_adp":  category == "bs_post_adp",
        "is_adp":          category == "adp",
        "is_bed":          category == "bed",
        "is_bba_bfa":      category == "bba_bfa",
        "is_ms_phd":       category == "ms_phd",
        "is_regulatory":   category == "regulatory",
        "is_financial":    category == "financial",

        # ── Quality flags ─────────────────────────────────────────────────────
        "is_corrupt":      chunk.get("is_corrupt", False),

        # ── Content ───────────────────────────────────────────────────────────
        "chunk_length":    len(text),
        "text_preview":    text[:200].strip(),
        "text":            text_safe,

        # ── Timestamp ─────────────────────────────────────────────────────────
        "ingested_at":     datetime.now().isoformat(),
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
    """Embed texts and upsert to Pinecone in controlled batches."""
    texts = [m["text"] for m in metas]
    total = 0

    for i in range(0, len(texts), EMBED_BATCH):
        batch_texts = texts[i: i + EMBED_BATCH]
        batch_metas = metas[i: i + EMBED_BATCH]

        try:
            vectors_raw = embedder.embed_documents(batch_texts)
        except Exception as e:
            log.error(f"  Embedding error at batch {i}: {e}")
            continue

        records = [
            {"id": m["chunk_id"], "values": v, "metadata": m}
            for m, v in zip(batch_metas, vectors_raw)
        ]

        if dry_run:
            log.info(f"  [dry-run] Would upsert {len(records)} vectors "
                     f"(batch {i // EMBED_BATCH + 1})")
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

    parser = argparse.ArgumentParser(
        description="about_university.json Pinecone ingestion"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Parse and embed only — no Pinecone upsert"
    )
    args = parser.parse_args()

    # ── Env validation ────────────────────────────────────────────────────────
    for key in ("PINECONE_API_KEY", "OPENAI_API_KEY"):
        if not os.getenv(key):
            raise EnvironmentError(f"Missing env var: {key}")

    # ── Load JSON ─────────────────────────────────────────────────────────────
    if not JSON_FILE.exists():
        raise FileNotFoundError(f"JSON file not found: {JSON_FILE}")

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        entries = json.load(f)

    log.info(f"\n{'='*60}")
    log.info(f"About University Summaries Ingestion")
    log.info(f"Source   : {JSON_FILE.name}")
    log.info(f"Index    : {PINECONE_INDEX}")
    log.info(f"NS       : {PINECONE_NS}")
    log.info(f"Entries  : {len(entries)}")
    log.info(f"Dry-run  : {args.dry_run}")
    log.info(f"{'='*60}\n")

    # ── Parse ─────────────────────────────────────────────────────────────────
    raw_chunks = parse_about_data(entries)

    # ── Print category breakdown ──────────────────────────────────────────────
    from collections import Counter
    type_counts = Counter(c["chunk_type"] for c in raw_chunks)
    cat_counts  = Counter(
        c.get("category", "n/a")
        for c in raw_chunks
        if c["chunk_type"] == "program_summary"
    )

    log.info(f"\nChunk breakdown:")
    for ctype, n in sorted(type_counts.items()):
        log.info(f"  {ctype:<25} {n}")
    log.info(f"\nProgram summary by category:")
    for cat, n in sorted(cat_counts.items()):
        label = CATEGORY_LABELS.get(cat, cat)
        log.info(f"  {label:<40} {n}")
    log.info(f"\n  TOTAL: {len(raw_chunks)} chunks\n")

    # ── Finalize metadata ─────────────────────────────────────────────────────
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
            spec      = ServerlessSpec(cloud=PINECONE_CLOUD, region=PINECONE_REGION),
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