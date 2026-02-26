"""
Smart RAG Configuration

Constants for the self-correcting retrieval system with best-effort answering.

Features:
  - 3 retry attempts with progressive strategy escalation
  - Best-effort answering: after exhausting retries, answers with whatever
    chunks were collected rather than returning empty
  - Clarification detection: when results are thin, asks user for details
  - Only uses fallback message when literally zero chunks exist
"""

SMART_RAG_CONFIG = {
    "max_retries": 3,                # Max re-retrieval attempts after initial try
    "min_relevant_chunks": 3,        # Minimum relevant chunks needed to skip retries
    "confidence_threshold": 0.75,    # Minimum confidence score for a chunk to be relevant
    "grading_model": "gpt-4o-mini",  # Model for grading chunks (cheap + fast)
    "rewriting_model": "gpt-4o-mini",# Model for query rewriting
    "retry_top_k_boost": 4,          # Extra chunks to retrieve on each retry
    "clarification_model": "gpt-4o-mini",  # Model for clarification detection
    "early_success_threshold": 3,    # If this many relevant chunks found, stop immediately
    "avg_confidence_threshold": 0.80,# Minimum average confidence for quality gate
}

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
