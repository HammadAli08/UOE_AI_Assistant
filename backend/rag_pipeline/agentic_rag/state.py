"""
Agentic RAG State — Mutable state object carried through the agent graph.

Every node reads and writes to this state, enabling full observability
and decision tracing across the entire pipeline.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set


@dataclass
class AgentState:
    """Mutable state carried through the agentic decision graph."""

    # ── Input (set once at creation) ─────────────────────────────────
    user_query: str = ""
    namespace: str = ""
    session_id: str = ""
    chat_history: List[Dict[str, str]] = field(default_factory=list)
    enhanced_query: str = ""
    top_k: int = 5
    filter_stages: List[Dict] = field(default_factory=list)

    # ── Agent decisions ──────────────────────────────────────────────
    intent: str = ""                          # DIRECT / RETRIEVE / DECOMPOSE / CLARIFY
    sub_queries: List[Dict[str, str]] = field(default_factory=list)

    # ── Retrieval state ──────────────────────────────────────────────
    current_query: str = ""
    documents: List[Dict] = field(default_factory=list)
    all_relevant: List[Dict] = field(default_factory=list)
    all_irrelevant: List[Dict] = field(default_factory=list)
    seen_ids: Set[str] = field(default_factory=set)
    attempt: int = 0

    # ── Per-Sub-Query Execution state ────────────────────────────────
    # Isolated state bounds for decomposed pathways (Q1, Q2, etc.)
    sub_query_results: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    # ── Generation state ─────────────────────────────────────────────
    answer: str = ""
    is_grounded: bool = True
    grounding_score: float = 1.0
    ungrounded_claims: List[str] = field(default_factory=list)

    # ── Decision trace (every node appends its action here) ──────────
    steps: List[Dict[str, Any]] = field(default_factory=list)
    total_retrievals: int = 0
    query_rewrites: List[Dict] = field(default_factory=list)

    # ── Output ───────────────────────────────────────────────────────
    sources: List[Dict] = field(default_factory=list)
    clarification: Optional[str] = None
    direct_response: Optional[str] = None
    used_fallback: bool = False
    best_effort: bool = False

    # ── Timing ───────────────────────────────────────────────────────
    _start_time: float = field(default_factory=time.perf_counter)

    # ── Helpers ──────────────────────────────────────────────────────

    def log_step(self, node: str, **details: Any) -> None:
        """Append a decision-trace entry."""
        elapsed_ms = round((time.perf_counter() - self._start_time) * 1000, 1)
        self.steps.append({"node": node, "elapsed_ms": elapsed_ms, **details})

    def build_agentic_info(self) -> Dict[str, Any]:
        """Build the metrics dict returned to the frontend."""
        return {
            "intent": self.intent,
            "steps": self.steps,
            "total_retrievals": self.total_retrievals,
            "total_chunks_graded": sum(
                s.get("relevant", 0) + s.get("irrelevant", 0)
                for s in self.steps
                if s.get("node") == "grade"
            ),
            "query_rewrites": self.query_rewrites,
            "final_relevant_chunks": len(self.all_relevant),
            "decomposed_queries": self.sub_queries if self.sub_queries else [],
            "hallucination_score": round(self.grounding_score, 2),
            "is_grounded": self.is_grounded,
            "used_fallback": self.used_fallback,
            "best_effort": self.best_effort,
            "clarification_asked": self.clarification is not None,
        }
