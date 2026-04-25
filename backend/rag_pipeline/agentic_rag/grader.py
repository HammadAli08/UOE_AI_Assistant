"""
Chunk Grader — Confidence-Based Relevance Grading (Batched)

Grades ALL retrieved chunks in a single LLM call using GPT-4o-mini with:
  - 5 evaluation signals (topic, program, specificity, department/year, completeness)
  - Confidence scoring (0.0–1.0) instead of binary yes/no
  - JSON array output for structured batch decisions

Chunks below ``confidence_threshold`` are rejected even if labeled relevant.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from openai import OpenAI

from langsmith import traceable

from ..config import OPENAI_API_KEY, SYSTEM_PROMPTS_DIR
from .config import AGENTIC_RAG_CONFIG

logger = logging.getLogger(__name__)

_GRADING_PROMPT_FILE = "grading_prompt.txt"


class ChunkGrader:
    """
    Grades retrieved chunks for relevance using confidence scoring.

    All chunks are graded in a **single** LLM call (batched prompt)
    to eliminate per-chunk latency.
    """

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = AGENTIC_RAG_CONFIG["grading_model"]
        self.confidence_threshold = AGENTIC_RAG_CONFIG["confidence_threshold"]
        self._prompt_template: Optional[str] = None

    @property
    def prompt_template(self) -> str:
        """Lazy-load the grading prompt from system_prompts/."""
        if self._prompt_template is None:
            prompt_path = SYSTEM_PROMPTS_DIR / _GRADING_PROMPT_FILE
            if prompt_path.exists():
                self._prompt_template = prompt_path.read_text().strip()
            else:
                self._prompt_template = (
                    "Question: {query}\n\n"
                    "{chunks_block}\n\n"
                    "A chunk is relevant if confidence >= {confidence_threshold}.\n\n"
                    "Respond with a JSON array of objects, one per chunk:\n"
                    '[{{"index": 0, "relevant": true/false, '
                    '"confidence": 0.0-1.0, "reason": "..."}}]'
                )
        return self._prompt_template

    @staticmethod
    def _build_chunks_block(chunks: List[Dict]) -> str:
        """Format all chunks into a numbered block for the prompt."""
        lines: List[str] = []
        for i, chunk in enumerate(chunks):
            metadata = chunk.get("metadata", {})
            source = metadata.get("source_file", "Unknown")
            page = metadata.get("page_number", "N/A")
            text = chunk.get("text", "")[:1500]
            lines.append(
                f"[Chunk {i}]\n"
                f"Source: {source}, Page: {page}\n"
                f"Content: {text}\n"
                f"---"
            )
        return "\n".join(lines)

    @traceable(name="agentic_rag.grade_chunks", run_type="chain")
    def grade_chunks(
        self,
        query: str,
        chunks: List[Dict],
    ) -> Tuple[List[Dict], List[Dict]]:
        """
        Grade all retrieved chunks in a **single** LLM call.

        Args:
            query:  The user's question
            chunks: Retrieved document dicts (must have 'text' and 'metadata')

        Returns:
            (relevant_chunks, irrelevant_chunks)
            Each chunk in irrelevant_chunks gets an extra 'grade_reason' key.
        """
        if not chunks:
            return [], []

        try:
            chunks_block = self._build_chunks_block(chunks)
            prompt = self.prompt_template.format(
                query=query,
                chunks_block=chunks_block,
                confidence_threshold=self.confidence_threshold,
            )

            max_tokens = max(200, 60 * len(chunks))

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=max_tokens,
                timeout=AGENTIC_RAG_CONFIG["llm_timeout"],
            )
            raw = resp.choices[0].message.content.strip()

            grades = self._parse_batch_grades(raw, len(chunks))

        except Exception as exc:
            logger.warning("Batch grading error: %s — forcing retry", exc)
            for chunk in chunks:
                chunk["grade_confidence"] = 0.0
                chunk["grade_reason"] = f"Grading failed: {exc}"
            return [], list(chunks)

        relevant: List[Dict] = []
        irrelevant: List[Dict] = []

        for i, chunk in enumerate(chunks):
            grade = grades[i] if i < len(grades) else {
                "relevant": False, "confidence": 0.0, "reason": "Missing grade entry"
            }

            if grade["relevant"] and grade["confidence"] >= self.confidence_threshold:
                chunk["grade_confidence"] = grade["confidence"]
                relevant.append(chunk)
            else:
                chunk["grade_reason"] = grade.get("reason", "Low relevance")
                chunk["grade_confidence"] = grade["confidence"]
                irrelevant.append(chunk)

        logger.info(
            "Grading: %d relevant, %d irrelevant out of %d chunks",
            len(relevant), len(irrelevant), len(chunks),
        )
        return relevant, irrelevant

    @staticmethod
    def _parse_batch_grades(raw: str, expected: int) -> List[Dict]:
        """Parse the LLM's JSON array response.

        On parse failure, returns all chunks as irrelevant with 0.0 confidence
        so the retry loop can attempt recovery. This is the safe default —
        silently accepting all chunks on parse failure would bypass quality gates.
        """
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            arr = json.loads(cleaned)
            if isinstance(arr, list):
                results: List[Dict] = []
                for item in arr:
                    results.append({
                        "relevant": bool(item.get("relevant", False)),
                        "confidence": float(item.get("confidence", 0.0)),
                        "reason": str(item.get("reason", "")),
                    })
                while len(results) < expected:
                    results.append({
                        "relevant": False,
                        "confidence": 0.0,
                        "reason": "Missing from LLM response — rejected for safety",
                    })
                return results
        except (json.JSONDecodeError, ValueError, KeyError):
            pass

        logger.error(
            "Failed to parse batch grades JSON — rejecting all %d chunks for safety. "
            "Raw response: %s",
            expected, raw[:200],
        )
        return [
            {"relevant": False, "confidence": 0.0, "reason": "JSON parse failure — rejected for safety"}
            for _ in range(expected)
        ]
