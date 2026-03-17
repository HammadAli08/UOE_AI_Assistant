"""
Hallucination Guard — Post-generation grounding verification

After the generator produces an answer, this module checks whether
every factual claim is traceable to the retrieved source documents.

Actions based on grounding score:
  ≥ 0.6  → Accept answer as-is
  < 0.6  → Flag ungrounded claims, optionally regenerate with stricter prompt
"""

import json
import logging
from typing import Dict, List, Optional, Tuple

from openai import OpenAI
from langsmith import traceable

from ..config import OPENAI_API_KEY, SYSTEM_PROMPTS_DIR
from .config import AGENTIC_RAG_CONFIG

logger = logging.getLogger(__name__)

_HALLUCINATION_PROMPT_FILE = "agentic_hallucination_prompt.txt"


class HallucinationGuard:
    """Verifies generated answers against retrieved source documents."""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = AGENTIC_RAG_CONFIG["hallucination_model"]
        self.threshold = AGENTIC_RAG_CONFIG["hallucination_threshold"]
        self._prompt_template: Optional[str] = None

    @property
    def prompt_template(self) -> str:
        if self._prompt_template is None:
            prompt_path = SYSTEM_PROMPTS_DIR / _HALLUCINATION_PROMPT_FILE
            if prompt_path.exists():
                self._prompt_template = prompt_path.read_text().strip()
            else:
                self._prompt_template = (
                    "Sources:\n{sources_block}\n\n"
                    "Answer:\n{answer}\n\n"
                    "Is this answer grounded in the sources? Respond with JSON:\n"
                    '{{"grounded": true/false, "score": 0.0-1.0, '
                    '"ungrounded_claims": [], "reasoning": "..."}}'
                )
        return self._prompt_template

    @staticmethod
    def _build_sources_block(documents: List[Dict]) -> str:
        """Format retrieved documents for the hallucination prompt."""
        lines: List[str] = []
        for i, doc in enumerate(documents):
            metadata = doc.get("metadata", {})
            source = metadata.get("source_file", "Unknown")
            page = metadata.get("page_number", "N/A")
            text = doc.get("text", "")[:1200]
            lines.append(
                f"[Source {i + 1}]\n"
                f"File: {source}, Page: {page}\n"
                f"Content: {text}\n"
                f"---"
            )
        return "\n".join(lines)

    @traceable(name="agentic_rag.hallucination_check", run_type="chain")
    def check(
        self,
        answer: str,
        documents: List[Dict],
    ) -> Tuple[bool, float, List[str]]:
        """
        Check if the generated answer is grounded in the source documents.

        Args:
            answer:    The generated response text
            documents: The retrieved chunks used for generation

        Returns:
            (is_grounded, score, ungrounded_claims)
        """
        if not answer or not documents:
            return True, 1.0, []

        try:
            sources_block = self._build_sources_block(documents)
            prompt = self.prompt_template.format(
                sources_block=sources_block,
                answer=answer,
            )

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=AGENTIC_RAG_CONFIG["hallucination_temperature"],
                max_tokens=AGENTIC_RAG_CONFIG["hallucination_max_tokens"],
            )
            raw = resp.choices[0].message.content.strip()

            result = self._parse_result(raw)
            score = result.get("score", 1.0)
            is_grounded = score >= self.threshold
            ungrounded = result.get("ungrounded_claims", [])

            logger.info(
                "Hallucination check: score=%.2f, grounded=%s, claims=%d",
                score, is_grounded, len(ungrounded),
            )
            return is_grounded, score, ungrounded

        except Exception as exc:
            logger.warning("Hallucination check failed: %s — assuming grounded", exc)
            return True, 1.0, []

    @staticmethod
    def _parse_result(raw: str) -> Dict:
        """Parse the LLM's JSON response."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
            if isinstance(result, dict):
                return {
                    "grounded": bool(result.get("grounded", True)),
                    "score": float(result.get("score", 1.0)),
                    "ungrounded_claims": list(result.get("ungrounded_claims", [])),
                    "reasoning": str(result.get("reasoning", "")),
                }
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

        logger.warning("Could not parse hallucination check response")
        return {"grounded": True, "score": 1.0, "ungrounded_claims": []}


# ── Singleton ────────────────────────────────────────────────────────
_guard: Optional[HallucinationGuard] = None


def get_hallucination_guard() -> HallucinationGuard:
    global _guard
    if _guard is None:
        _guard = HallucinationGuard()
    return _guard
