"""
Generate consolidated "About University" summaries from all PDF sources (BS/ADP, MS/PhD,
Rules & Regulations) and write them to a JSON file for later ingestion.

Outputs: Data/about_university.json
Structure:
[
  {
    "id": "<slugified_pdf_name>",
    "source_file": "<pdf filename>",
    "summary": "<concise, student-facing about text>"
  },
  ...
]

Usage:
    python Data_Ingestion/generate_about_json.py
"""

import json
import logging
import argparse
from pathlib import Path
from typing import List, Dict

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATA_ROOT = Path("Data")
PDF_DIRS = [
    DATA_ROOT / "BS&ADP",
    DATA_ROOT / "Ms&Phd",
    DATA_ROOT / "Rules",
]
OUTPUT_JSON = DATA_ROOT / "about_university.json"
PROGRESS_JSON = DATA_ROOT / "about_progress.json"

# Limit how much text we feed into the model per source to control cost while keeping fidelity
MAX_SOURCE_CHARS = 20000
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 200

SYSTEM_PROMPT = """You are writing a concise, student-facing “About the University” entry.
Use only the provided source text. Produce a clear narrative (2–4 short paragraphs) that covers:
- What programs/levels the university offers (BS/ADP, MS/PhD), key disciplines/departments.
- Academic structure: semesters/shifts, credit-hour patterns if stated.
- High-level admission or eligibility notes if present (no detailed forms).
- Rules & regulations highlights: attendance, examinations, conduct, fee/refund, hostel/guest, shift change.
- Facilities or student services mentioned.
- Any important procedures (fee refund process, shift change notification, etc.).

Do NOT include:
- Individual course syllabi, reading lists, CLO tables, page numbers, personal data, signatures.
- Extremely granular details (e.g., specific book titles, section numbers) unless essential to understand a rule.

Tone: factual, concise, helpful for a student deciding or navigating basics."""


def slugify(name: str) -> str:
    return (
        name.lower()
        .replace(" ", "-")
        .replace("(", "")
        .replace(")", "")
        .replace("&", "and")
        .replace("_", "-")
        .replace(".", "-")
    )


def sanitize(text: str) -> str:
    """Ensure text is valid UTF-8 JSON-serializable."""
    if not isinstance(text, str):
        text = str(text)
    return text.encode("utf-8", "replace").decode("utf-8")


def load_pdf_text(path: Path) -> str:
    loader = PyPDFLoader(str(path))
    pages = loader.load()
    text = " ".join(p.page_content for p in pages)
    return sanitize(text)[:MAX_SOURCE_CHARS]


def summarize_source(client: OpenAI, text: str) -> str:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, length_function=len
    )
    chunks = [sanitize(c) for c in splitter.split_text(text)]

    # If the text is short, summarize directly
    if len(chunks) == 1:
        content = chunks[0]
    else:
        # Map-reduce style: summarize chunks, then summarize summaries
        partial_summaries: List[str] = []
        for ch in chunks:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": sanitize(f"Source chunk:\n{ch}")},
                ],
                temperature=0.3,
                max_tokens=400,
            )
            partial_summaries.append(resp.choices[0].message.content.strip())

        merged_text = sanitize("\n".join(partial_summaries))[:MAX_SOURCE_CHARS]
        content = merged_text

    final = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": sanitize(f"Combine and finalize:\n{content}")},
        ],
        temperature=0.25,
        max_tokens=500,
    )
    return final.choices[0].message.content.strip()


def load_existing(reset: bool):
    existing = {}
    if not reset and OUTPUT_JSON.exists():
        try:
            with OUTPUT_JSON.open() as f:
                data = json.load(f)
                for entry in data:
                    existing[entry["source_file"]] = entry
        except Exception:
            pass

    completed = set()
    if not reset and PROGRESS_JSON.exists():
        try:
            with PROGRESS_JSON.open() as f:
                prog = json.load(f)
                completed = set(prog.get("completed", []))
        except Exception:
            pass

    return existing, completed


def save_state(entries: Dict[str, Dict], completed: set):
    # Persist output
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON.open("w") as f:
        json.dump(list(entries.values()), f, indent=2)

    # Persist progress
    with PROGRESS_JSON.open("w") as f:
        json.dump({"completed": sorted(list(completed))}, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Generate About-University summaries.")
    parser.add_argument("--reset", action="store_true", help="Recompute all PDFs from scratch.")
    args = parser.parse_args()

    client = OpenAI()

    existing, completed = load_existing(reset=args.reset)
    records = existing  # dict keyed by source_file

    pdf_paths = [p for d in PDF_DIRS for p in d.glob("*.pdf")]
    logger.info("Found %d PDFs", len(pdf_paths))

    for pdf in pdf_paths:
        if not args.reset and pdf.name in completed:
            logger.info("Skipping %s (already completed)", pdf.name)
            continue

        logger.info("Summarizing %s", pdf.name)
        raw_text = load_pdf_text(pdf)
        summary = summarize_source(client, raw_text)

        records[pdf.name] = {
            "id": slugify(pdf.stem),
            "source_file": pdf.name,
            "summary": summary,
        }
        completed.add(pdf.name)
        save_state(records, completed)  # flush progress incrementally
        logger.info("Saved progress (%d/%d)", len(completed), len(pdf_paths))

    logger.info("Wrote %d summaries to %s", len(records), OUTPUT_JSON)


if __name__ == "__main__":
    main()
