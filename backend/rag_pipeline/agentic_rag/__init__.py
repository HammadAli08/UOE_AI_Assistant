"""
Agentic RAG Package — Autonomous Decision-Making Retrieval

Provides autonomous intent routing with a self-correcting
agentic system with:

  - IntentClassifier:    Routes queries (DIRECT / RETRIEVE / DECOMPOSE / CLARIFY)
  - QueryDecomposer:     Splits complex multi-part questions
  - HallucinationGuard:  Post-generation grounding verification
  - AgenticRAGGraph:     State-machine orchestrator driving all decisions

Includes ChunkGrader, QueryRewriter,
and autonomous retrieval decisioning.
"""

from .config import AGENTIC_RAG_CONFIG
from .state import AgentState
from .intent_classifier import IntentClassifier, get_intent_classifier
from .query_decomposer import QueryDecomposer, get_query_decomposer
from .hallucination_guard import HallucinationGuard, get_hallucination_guard
from .graph import AgenticRAGGraph, get_agentic_graph

__all__ = [
    "AGENTIC_RAG_CONFIG",
    "AgentState",
    "IntentClassifier",
    "QueryDecomposer",
    "HallucinationGuard",
    "AgenticRAGGraph",
    "get_intent_classifier",
    "get_query_decomposer",
    "get_hallucination_guard",
    "get_agentic_graph",
]
