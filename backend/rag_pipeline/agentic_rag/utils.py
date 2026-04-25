"""
Agentic RAG Utilities — Shared helpers for the agentic pipeline.

Contains pure functions used by both graph.py and pipeline.py
to avoid circular imports between the two.
"""

import logging

from .config import AGENTIC_RAG_CONFIG

logger = logging.getLogger(__name__)

# ── Grounding disclaimer messages ────────────────────────────────────────

_SOFT_WARNING = (
    "\n\n⚠️ *Note: Some details in this response may not be directly "
    "verified from the available documents. Please verify critical "
    "information with the university administration.*"
)

_STRONG_DISCLAIMER = (
    "\n\n⚠️ *This response could not be fully verified against the "
    "available documents. Specific claims may be inaccurate — please "
    "confirm with the university administration before relying on "
    "this information.*"
)


def apply_grounding_disclaimer(answer: str, score: float) -> str:
    """
    Apply a three-tier grounding disclaimer to a generated answer.

    Thresholds (aligned with agentic_hallucination_prompt.txt):
      score >= 0.75  → grounded   — pass answer as-is
      0.40 <= score  → partial    — append soft warning
      score < 0.40   → ungrounded — append strong disclaimer

    Args:
        answer: The generated response text.
        score:  Grounding score from hallucination guard (0.0–1.0).

    Returns:
        The answer, potentially with a disclaimer appended.
    """
    grounded_threshold = AGENTIC_RAG_CONFIG["hallucination_threshold"]
    partial_threshold = AGENTIC_RAG_CONFIG["hallucination_partial_threshold"]

    if score >= grounded_threshold:
        # Fully grounded — pass as-is
        return answer

    if score >= partial_threshold:
        # Partially grounded — soft warning
        logger.info(
            "Grounding: partial (score=%.2f) — appending soft warning", score,
        )
        return answer + _SOFT_WARNING

    # Ungrounded — strong disclaimer
    logger.warning(
        "Grounding: ungrounded (score=%.2f) — appending strong disclaimer", score,
    )
    return answer + _STRONG_DISCLAIMER
