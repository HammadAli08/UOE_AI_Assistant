"""
Intent Classifier — Autonomous query-intent detection

Classifies each incoming user query into one of four intents:
  DIRECT    → Answer without retrieval (greetings, meta questions)
  RETRIEVE  → Standard single-topic retrieval
  DECOMPOSE → Multi-part question needing sub-query splitting
  CLARIFY   → Too vague; ask user for more details

Uses a fast-path heuristic for common greetings to avoid LLM latency,
then falls back to GPT-4o-mini for complex queries.
"""

import json
import re
import logging
from typing import Dict, List, Optional

from openai import OpenAI
from langsmith import traceable

from ..config import OPENAI_API_KEY, SYSTEM_PROMPTS_DIR
from .config import (
    AGENTIC_RAG_CONFIG,
    INTENT_DIRECT,
    INTENT_RETRIEVE,
    INTENT_DECOMPOSE,
    INTENT_CLARIFY,
    VALID_INTENTS,
)

logger = logging.getLogger(__name__)

_INTENT_PROMPT_FILE = "agentic_intent_prompt.txt"

# ── Fast-path heuristic patterns for DIRECT intents ───────────────────────
# These patterns match common greetings and meta-questions that should
# be answered immediately without any LLM call for latency optimization.

_DIRECT_PATTERNS = [
    # Greetings (case-insensitive)
    r"^(hi|hello|hey|hiya|howdy|hi there|hello there|good (morning|afternoon|evening)|greetings)$",
    r"^(what's up|whats up|wassup|sup)$",
    # Meta questions about the bot
    r"^(who are you|what are you|what is this|what can you (do|help (me|with))|help|how (do|can) (i|you) (use|help)|tell me about (yourself|you))$",
    # Thanks
    r"^(thanks|thank you|thx|ty)$",
    # Bye
    r"^(bye|goodbye|see you|farewell)$",
    # Single words that are clearly not questions
    r"^(okay|ok|cool|nice|great|awesome|perfect)$",
]

_DIRECT_REGEX = [re.compile(p, re.IGNORECASE) for p in _DIRECT_PATTERNS]

# ── Fast-path response cache for DIRECT intents ───────────────────────────
# Pre-defined responses for common greetings to avoid LLM call entirely.

_DIRECT_FAST_RESPONSES = {
    "greeting": (
        "Hello! I'm the University of Education AI Assistant. "
        "I can help you with questions about BS/ADP programs, "
        "MS/PhD programs, and university rules & regulations. "
        "What would you like to know?"
    ),
    "meta": (
        "I'm the UOE AI Assistant, designed to help you find information "
        "about academic programs, courses, and university regulations. "
        "Just ask me a question!"
    ),
    "thanks": "You're welcome! Let me know if you need anything else.",
    "bye": "Goodbye! Feel free to return if you have more questions.",
}


class IntentClassifier:
    """Classifies user queries into action intents."""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = AGENTIC_RAG_CONFIG["intent_model"]
        self._prompt_template: Optional[str] = None

    def _is_fast_path_direct(self, query: str) -> tuple[bool, Optional[str]]:
        """
        Fast-path check for obvious DIRECT queries without LLM call.

        Returns (is_direct, fast_response) tuple.
        - is_direct: True if query matches DIRECT patterns
        - fast_response: Pre-defined response if available, None otherwise
        """
        query_stripped = query.strip()

        # Check against DIRECT patterns
        for pattern in _DIRECT_REGEX:
            if pattern.match(query_stripped):
                # Determine which pre-defined response to use
                lower_q = query_stripped.lower()

                # Greetings
                if any(g in lower_q for g in ['hi', 'hello', 'hey', 'howdy', 'greetings', 'morning', 'afternoon', 'evening', "what's up", 'whats up', 'wassup', 'sup']):
                    return True, _DIRECT_FAST_RESPONSES["greeting"]

                # Meta questions
                if any(m in lower_q for m in ['who are you', 'what are you', 'what is this', 'what can you', 'help', 'how do', 'how can', 'tell me about']):
                    return True, _DIRECT_FAST_RESPONSES["meta"]

                # Thanks
                if any(t in lower_q for t in ['thanks', 'thank you', 'thx', 'ty']):
                    return True, _DIRECT_FAST_RESPONSES["thanks"]

                # Bye
                if any(b in lower_q for b in ['bye', 'goodbye', 'see you', 'farewell']):
                    return True, _DIRECT_FAST_RESPONSES["bye"]

                # Generic positive response
                return True, None  # Will use LLM for response but skip classification

        return False, None

    @property
    def prompt_template(self) -> str:
        if self._prompt_template is None:
            prompt_path = SYSTEM_PROMPTS_DIR / _INTENT_PROMPT_FILE
            if prompt_path.exists():
                self._prompt_template = prompt_path.read_text().strip()
            else:
                self._prompt_template = (
                    "Classify this query into DIRECT, RETRIEVE, DECOMPOSE, or CLARIFY.\n"
                    "Chat context: {chat_context}\n"
                    "Query: {query}\n"
                    "Respond with one word only."
                )
        return self._prompt_template

    @staticmethod
    def _build_chat_context(chat_history: List[Dict[str, str]]) -> str:
        """Build a compact conversation context string."""
        if not chat_history:
            return "No prior conversation."
        recent = chat_history[-4:]  # last 2 turns
        lines = []
        for msg in recent:
            role = "User" if msg["role"] == "user" else "Assistant"
            content = msg["content"]
            if role == "Assistant" and len(content) > 120:
                content = content[:120] + "…"
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    @traceable(name="agentic_rag.classify_intent", run_type="chain")
    def classify(
        self,
        query: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Classify the user query into an intent.

        Uses fast-path heuristics for common greetings to avoid LLM latency.
        Falls back to LLM classification for complex queries.
        Returns one of: DIRECT, RETRIEVE, DECOMPOSE, CLARIFY
        Falls back to RETRIEVE on any error.
        """
        # ── Fast-path: Check for obvious DIRECT patterns first ─────────────
        is_direct, fast_response = self._is_fast_path_direct(query)
        if is_direct:
            logger.info("Fast-path DIRECT (no LLM call): '%s'", query[:60])
            # Store fast response for use by direct_answer node
            self._fast_response = fast_response
            return INTENT_DIRECT

        # ── Slow-path: Use LLM for non-obvious queries ───────────────────
        try:
            chat_context = self._build_chat_context(chat_history or [])
            prompt = self.prompt_template.format(
                query=query,
                chat_context=chat_context,
            )

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=AGENTIC_RAG_CONFIG["intent_temperature"],
                max_tokens=AGENTIC_RAG_CONFIG["intent_max_tokens"],
            )
            raw = resp.choices[0].message.content.strip()

            # ── Robust JSON extraction ───────────────────────────────
            cleaned = raw
            if "```" in raw:
                matches = re.findall(r"```(?:json)?\s*(.*?)\s*```", raw, re.DOTALL)
                if matches:
                    cleaned = matches[0]

            try:
                data = json.loads(cleaned)
                if isinstance(data, dict):
                    intent_val = str(data.get("intent", "")).upper()
                    suggested_ns = data.get("namespace")

                    found_intent = INTENT_RETRIEVE
                    for intent in VALID_INTENTS:
                        if intent == intent_val:
                            found_intent = intent
                            break

                    logger.info(
                        "Intent classified via JSON: '%s' → %s (Suggested NS: %s)",
                        query[:60], found_intent, suggested_ns,
                    )
                    
                    if found_intent == INTENT_DECOMPOSE:
                        found_intent = self._enforce_decomposition_guard(query, found_intent)
                        
                    self._suggested_namespace = suggested_ns
                    return found_intent

            except (json.JSONDecodeError, ValueError):
                pass  # fall through to string-search fallback

            # Fallback: simple string search in raw response
            raw_upper = raw.upper()
            for intent in VALID_INTENTS:
                if intent in raw_upper:
                    logger.info("Intent classified via text fallback: %s", intent)
                    if intent == INTENT_DECOMPOSE:
                        intent = self._enforce_decomposition_guard(query, intent)
                    return intent

            logger.warning(
                "Intent classifier returned unparseable response — defaulting to RETRIEVE",
            )
            return INTENT_RETRIEVE

        except Exception as exc:
            logger.warning("Intent classification failed: %s — defaulting to RETRIEVE", exc)
            return INTENT_RETRIEVE

    def get_suggested_namespace(self) -> Optional[str]:
        """Get the namespace suggested by the LLM during classification."""
        return getattr(self, '_suggested_namespace', None)

    def clear_suggestions(self) -> None:
        """Clear the suggested namespace."""
        if hasattr(self, '_suggested_namespace'):
            self._suggested_namespace = None

    def get_fast_response(self) -> Optional[str]:
        """Get pre-defined response from fast-path (if available)."""
        return getattr(self, '_fast_response', None)

    def clear_fast_response(self) -> None:
        """Clear stored fast response after use."""
        if hasattr(self, '_fast_response'):
            self._fast_response = None

    def _enforce_decomposition_guard(self, query: str, current_intent: str) -> str:
        """
        Guard against the LLM over-triggering DECOMPOSE for short/voice queries 
        that lack fundamental conjunctions indicating multi-intent structure.
        """
        words = [w.strip() for w in query.lower().split()]
        conjunctions = sum(1 for w in words if w in ['and', 'or', 'aur', 'also', 'furthermore', 'plus'])
        
        if conjunctions < 1 and len(words) < 15:
            logger.info("🛡️ Decomposition blocked: 0 conjunctions in <15 words. Downgrading to RETRIEVE.")
            return INTENT_RETRIEVE
        return current_intent


# ── Singleton ────────────────────────────────────────────────────────
_classifier: Optional[IntentClassifier] = None


def get_intent_classifier() -> IntentClassifier:
    global _classifier
    if _classifier is None:
        _classifier = IntentClassifier()
    return _classifier
