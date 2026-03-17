"""
Query Decomposer — Splits complex multi-part queries into sub-questions

When the intent classifier detects DECOMPOSE, this module breaks the
user's compound question into 2–4 independent sub-queries that each
target a different piece of information.

Each sub-query is then retrieved independently and the results are
merged for a comprehensive synthesized answer.
"""

import json
import logging
from typing import List, Optional

from openai import OpenAI
from langsmith import traceable

from ..config import OPENAI_API_KEY, SYSTEM_PROMPTS_DIR
from .config import AGENTIC_RAG_CONFIG

logger = logging.getLogger(__name__)

_DECOMPOSER_PROMPT_FILE = "agentic_decomposer_prompt.txt"


class QueryDecomposer:
    """Decomposes multi-part queries into independent sub-queries."""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = AGENTIC_RAG_CONFIG["decomposer_model"]
        self.max_sub_queries = AGENTIC_RAG_CONFIG["max_sub_queries"]
        self._prompt_template: Optional[str] = None

    @property
    def prompt_template(self) -> str:
        if self._prompt_template is None:
            prompt_path = SYSTEM_PROMPTS_DIR / _DECOMPOSER_PROMPT_FILE
            if prompt_path.exists():
                self._prompt_template = prompt_path.read_text().strip()
            else:
                self._prompt_template = (
                    "Break this complex query into {max_sub_queries} simple sub-queries.\n"
                    "Query: {query}\n"
                    'Respond with ONLY a JSON array of strings: ["sub-query 1", "sub-query 2"]'
                )
        return self._prompt_template

    @traceable(name="agentic_rag.decompose_query", run_type="chain")
    def decompose(self, query: str) -> List[str]:
        """
        Decompose a complex query into independent sub-queries.

        Returns a list of sub-query strings, or [original_query] on failure.
        """
        try:
            prompt = self.prompt_template.format(
                query=query,
                max_sub_queries=self.max_sub_queries,
            )

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=AGENTIC_RAG_CONFIG["decomposer_temperature"],
                max_tokens=AGENTIC_RAG_CONFIG["decomposer_max_tokens"],
            )
            raw = resp.choices[0].message.content.strip()

            # Parse JSON array
            sub_queries = self._parse_sub_queries(raw)

            if sub_queries and len(sub_queries) > 1:
                logger.info(
                    "Decomposed '%s' into %d sub-queries: %s",
                    query[:60], len(sub_queries), sub_queries,
                )
                return sub_queries[:self.max_sub_queries]

            # If decomposition produced ≤1 query, just use original
            logger.info("Decomposition produced single query — using original")
            return [query]

        except Exception as exc:
            logger.warning("Query decomposition failed: %s — using original query", exc)
            return [query]

    @staticmethod
    def _parse_sub_queries(raw: str) -> List[str]:
        """Parse the LLM's JSON array response."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            result = json.loads(cleaned)
            if isinstance(result, list):
                return [str(q).strip() for q in result if str(q).strip()]
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: try splitting by newlines
        lines = [l.strip().lstrip("- •0123456789.").strip()
                 for l in raw.split("\n") if l.strip()]
        return [l for l in lines if len(l) > 5]


# ── Singleton ────────────────────────────────────────────────────────
_decomposer: Optional[QueryDecomposer] = None


def get_query_decomposer() -> QueryDecomposer:
    global _decomposer
    if _decomposer is None:
        _decomposer = QueryDecomposer()
    return _decomposer
