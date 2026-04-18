"""
Agentic RAG Configuration

Constants for the agentic retrieval system with autonomous decision-making.

Extends the self-correcting retrieval loop and adds:
  - Intent classification (DIRECT / RETRIEVE / DECOMPOSE / CLARIFY)
  - Query decomposition for multi-part questions
  - Post-generation hallucination guard
"""

AGENTIC_RAG_CONFIG = {
    # ── Retry / quality controls (self-correcting loop) ──────────
    "max_retries": 5,
    "min_relevant_chunks": 1,
    "confidence_threshold": 0.65,
    "early_success_threshold": 2,
    "avg_confidence_threshold": 0.70,
    "retry_top_k_boost": 4,

    # ── Models ───────────────────────────────────────────────────────
    "grading_model": "gpt-4o-mini",
    "rewriting_model": "gpt-4o-mini",
    "intent_model": "gpt-4o-mini",
    "decomposer_model": "gpt-4o-mini",
    "hallucination_model": "gpt-4o-mini",
    "clarification_model": "gpt-4o-mini",
    "direct_answer_model": "gpt-4o-mini",

    # ── Intent classifier ────────────────────────────────────────────
    "intent_temperature": 0.0,
    "intent_max_tokens": 200,

    # ── Query decomposer ─────────────────────────────────────────────
    "max_sub_queries": 3,
    "decomposer_temperature": 0.0,
    "decomposer_max_tokens": 300,

    # ── Hallucination guard ──────────────────────────────────────────
    "hallucination_threshold": 0.5,     # below this → flag or regenerate
    "hallucination_temperature": 0.0,
    "hallucination_max_tokens": 200,
    "max_hallucination_retries": 1,     # regenerate once if ungrounded

}

# ── Intent enum values ───────────────────────────────────────────────
INTENT_DIRECT = "DIRECT"
INTENT_RETRIEVE = "RETRIEVE"
INTENT_DECOMPOSE = "DECOMPOSE"
INTENT_CLARIFY = "CLARIFY"

VALID_INTENTS = {INTENT_DIRECT, INTENT_RETRIEVE, INTENT_DECOMPOSE, INTENT_CLARIFY}

# ── Fallback messages ────────────────────────────────────────────────
NO_RESULTS_MESSAGE = (
    "I wasn't able to find information matching your query in the available documents.\n\n"
    "This could be because:\n"
    "- The information you need may not be in the uploaded files\n"
    "- The specific details you're looking for might be in a different category "
    "(BS/ADP, MS/PhD, or Rules & Regulations)\n"
    "- Try using different keywords or adding more specific details "
    "(course code, program name, batch year)\n"
)

CLARIFICATION_MESSAGE_TEMPLATE = (
    "I found some partial information but I'm not fully confident in the results. "
    "Could you help me narrow down the search?\n\n"
    "{suggestions}\n\n"
    "With more details, I can find more accurate information for you."
)
