"""
Agentic RAG Graph — Autonomous Decision-Making State Machine

Autonomous decision-making state machine replacing the linear
autonomous decision graph:

  ┌───────────────┐
  │ classify_intent│
  └──────┬────────┘
         │
    ┌────┼────┬──────────┐
    ▼    ▼    ▼          ▼
  DIRECT RETRIEVE DECOMPOSE CLARIFY
    │    │        │          │
    │    ▼        ▼          │
    │  retrieve  decompose   │
    │    │       & merge     │
    │    ▼        │          │
    │  rerank     ▼          │
    │    │      rerank       │
    │    ▼        │          │
    │  grade      ▼          │
    │    │      grade        │
    │    ├─ retry?           │
    │    ▼        ▼          │
    │  generate generate     │
    │    │        │          │
    │    ▼        ▼          │
    │  hallucination_check   │
    │    │        │          │
    └────┴────────┴──────────┘
                  ▼
              RESPONSE

Uses the ChunkGrader and QueryRewriter for self-correcting retrieval.
"""

import logging
import time
from typing import Dict, List, Optional

from openai import OpenAI
from langsmith import traceable

from ..config import OPENAI_API_KEY, SYSTEM_PROMPTS_DIR
from .grader import ChunkGrader
from .rewriter import QueryRewriter

from .config import (
    AGENTIC_RAG_CONFIG,
    INTENT_DIRECT,
    INTENT_RETRIEVE,
    INTENT_DECOMPOSE,
    INTENT_CLARIFY,
    NO_RESULTS_MESSAGE,
    CLARIFICATION_MESSAGE_TEMPLATE,
)
from .state import AgentState
from .intent_classifier import IntentClassifier
from .query_decomposer import QueryDecomposer
from .hallucination_guard import HallucinationGuard

logger = logging.getLogger(__name__)


class AgenticRAGGraph:
    """
    Autonomous decision-making state machine for RAG.

    Each method is a *node* — it reads from AgentState, performs work,
    writes results back, and logs the decision for full observability.
    The `run()` method drives the graph by calling nodes in sequence
    based on conditional branching.
    """

    def __init__(self, retriever, generator, query_enhancer, reranker=None):
        # Injected pipeline components
        self.retriever = retriever
        self.generator = generator
        self.query_enhancer = query_enhancer
        self.reranker = reranker

        # Agentic-specific components
        self.intent_classifier = IntentClassifier()
        self.decomposer = QueryDecomposer()
        self.grader = ChunkGrader()
        self.rewriter = QueryRewriter()
        self.hallucination_guard = HallucinationGuard()
        self.client = OpenAI(api_key=OPENAI_API_KEY)

        # Config shortcuts
        self.max_retries = AGENTIC_RAG_CONFIG["max_retries"]
        self.min_relevant = AGENTIC_RAG_CONFIG["min_relevant_chunks"]
        self.retry_boost = AGENTIC_RAG_CONFIG["retry_top_k_boost"]
        self.early_success = AGENTIC_RAG_CONFIG["early_success_threshold"]
        self.quality_threshold = AGENTIC_RAG_CONFIG["avg_confidence_threshold"]
        self.rerank_enabled = AGENTIC_RAG_CONFIG["rerank_enabled"]
        self.reranker_top_k = AGENTIC_RAG_CONFIG["reranker_top_k"]
        self.max_hallucination_retries = AGENTIC_RAG_CONFIG["max_hallucination_retries"]

    # ═══════════════════════════════════════════════════════════════════
    # GRAPH NODES
    # ═══════════════════════════════════════════════════════════════════

    def _node_classify_intent(self, state: AgentState) -> None:
        """Node 1: Classify user intent."""
        state.intent = self.intent_classifier.classify(
            state.user_query, state.chat_history,
        )
        state.log_step("classify_intent", intent=state.intent)

    def _node_direct_answer(self, state: AgentState) -> None:
        """Node: Answer directly without retrieval (greetings, meta questions)."""
        # ── Fast-path: Use pre-defined response for common greetings ───────
        fast_response = self.intent_classifier.get_fast_response()
        if fast_response:
            state.direct_response = fast_response
            self.intent_classifier.clear_fast_response()
            state.log_step("direct_answer", response_length=len(state.direct_response), fast_path=True)
            return

        # ── Slow-path: Use LLM for non-pre-defined DIRECT queries ─────────
        try:
            # Load namespace-specific system prompt for context
            resp = self.client.chat.completions.create(
                model=AGENTIC_RAG_CONFIG["direct_answer_model"],
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a friendly AI assistant for the University of Education, Lahore. "
                            "Answer the user's conversational query naturally without referencing documents. "
                            "If they greet you, greet them back warmly. If they ask what you can do, "
                            "explain that you help with university academic queries across BS/ADP programs, "
                            "MS/PhD programs, and university rules & regulations."
                        ),
                    },
                    {"role": "user", "content": state.user_query},
                ],
                temperature=0.5,
                max_tokens=200,
            )
            state.direct_response = resp.choices[0].message.content.strip()
        except Exception as exc:
            logger.warning("Direct answer failed: %s", exc)
            state.direct_response = (
                "Hello! I'm the University of Education AI Assistant. "
                "I can help you with questions about BS/ADP programs, "
                "MS/PhD programs, and university rules & regulations. "
                "What would you like to know?"
            )
        state.log_step("direct_answer", response_length=len(state.direct_response or ""), fast_path=False)

    def _node_request_clarification(self, state: AgentState) -> None:
        """Node: Ask user for more specific details."""
        try:
            resp = self.client.chat.completions.create(
                model=AGENTIC_RAG_CONFIG["clarification_model"],
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an AI assistant for University of Education, Lahore. "
                            "The user's query is too vague to search effectively. "
                            "Ask 2-3 specific follow-up questions to narrow down what they need. "
                            "Focus on: program type (BS/MS/PhD), department, batch year, "
                            "specific regulation, or course details. Be friendly and concise."
                        ),
                    },
                    {"role": "user", "content": state.user_query},
                ],
                temperature=0.3,
                max_tokens=200,
            )
            state.clarification = resp.choices[0].message.content.strip()
        except Exception as exc:
            logger.warning("Clarification generation failed: %s", exc)
            state.clarification = (
                "Could you provide more details? For example:\n"
                "- Which program are you asking about (BS, MS, PhD)?\n"
                "- Which department or subject area?\n"
                "- Are you looking for admission requirements, fee structure, or course details?"
            )
        state.log_step("request_clarification")

    def _node_decompose(self, state: AgentState) -> None:
        """Node: Decompose a complex query into sub-queries."""
        state.sub_queries = self.decomposer.decompose(state.user_query)
        state.log_step(
            "decompose",
            sub_queries=state.sub_queries,
            count=len(state.sub_queries),
        )

    def _node_retrieve(self, state: AgentState, query: str, attempt: int) -> List[Dict]:
        """Node: Retrieve documents for a single query."""
        retrieve_k = state.top_k + (self.retry_boost * attempt)
        documents = self.retriever.ensemble_retrieve(
            query=query,
            namespace=state.namespace,
            top_k=retrieve_k,
        )
        state.total_retrievals += 1
        state.log_step(
            "retrieve",
            query=query[:80],
            attempt=attempt,
            docs_found=len(documents),
            top_k=retrieve_k,
        )
        return documents

    def _node_rerank(self, state: AgentState, documents: List[Dict], query: str) -> List[Dict]:
        """Node: Rerank documents using cross-encoder (if available)."""
        if not self.rerank_enabled or self.reranker is None:
            state.log_step("rerank", skipped=True, reason="reranker not available")
            return documents

        try:
            reranked = self.reranker.rerank(
                query=query,
                documents=documents,
                top_k=self.reranker_top_k,
            )
            state.log_step(
                "rerank",
                input_count=len(documents),
                output_count=len(reranked),
            )
            return reranked
        except Exception as exc:
            logger.warning("Reranking failed: %s — using original order", exc)
            state.log_step("rerank", skipped=True, reason=str(exc))
            return documents

    def _node_grade(
        self, state: AgentState, documents: List[Dict],
    ) -> tuple:
        """Node: Grade chunks for relevance."""
        relevant, irrelevant = self.grader.grade_chunks(state.user_query, documents)
        state.log_step(
            "grade",
            relevant=len(relevant),
            irrelevant=len(irrelevant),
            total=len(documents),
        )
        return relevant, irrelevant

    def _node_rewrite(self, state: AgentState) -> str:
        """Node: Rewrite the query for retry."""
        rewritten = self.rewriter.rewrite(
            state.user_query, state.all_irrelevant, state.attempt,
        )
        state.query_rewrites.append({
            "attempt": state.attempt,
            "rewritten_query": rewritten,
        })
        state.log_step(
            "rewrite",
            attempt=state.attempt,
            original=state.user_query[:60],
            rewritten=rewritten[:80],
        )
        return rewritten

    def _node_hallucination_check(self, state: AgentState) -> None:
        """Node: Check if the answer is grounded in sources."""
        is_grounded, score, claims = self.hallucination_guard.check(
            state.answer, state.all_relevant,
        )
        state.is_grounded = is_grounded
        state.grounding_score = score
        state.ungrounded_claims = claims
        state.log_step(
            "hallucination_check",
            grounded=is_grounded,
            score=round(score, 2),
            ungrounded_count=len(claims),
        )

    # ═══════════════════════════════════════════════════════════════════
    # RETRIEVAL LOOP (shared by RETRIEVE and DECOMPOSE paths)
    # ═══════════════════════════════════════════════════════════════════

    def _retrieval_loop(self, state: AgentState, query: str) -> None:
        """
        Self-correcting retrieval loop for a single query.
        Self-correcting retrieval loop for a single query.
        Uses grade→rewrite→retry pattern with
        """
        current_query = query

        for attempt in range(self.max_retries + 1):
            state.attempt = attempt

            # Retrieve
            documents = self._node_retrieve(state, current_query, attempt)
            if not documents:
                if attempt < self.max_retries:
                    current_query = self._node_rewrite(state)
                    continue
                break

            # Rerank (new! wires the previously-dead reranker)
            documents = self._node_rerank(state, documents, current_query)

            # Grade against original user query (not rewritten)
            relevant, irrelevant = self._node_grade(state, documents)

            # Accumulate (deduplicate by ID)
            for chunk in relevant:
                chunk_id = chunk.get("id", id(chunk))
                if chunk_id not in state.seen_ids:
                    state.seen_ids.add(chunk_id)
                    state.all_relevant.append(chunk)
            state.all_irrelevant.extend(irrelevant)

            # Decision: enough quality to stop?
            if len(relevant) >= self.min_relevant:
                avg_conf = (
                    sum(c.get("grade_confidence", 0.0) for c in relevant)
                    / max(len(relevant), 1)
                )
                if avg_conf >= self.quality_threshold:
                    state.log_step(
                        "quality_gate",
                        decision="pass",
                        relevant=len(relevant),
                        avg_confidence=round(avg_conf, 2),
                    )
                    break

            # Decision: accumulated enough across all attempts?
            if len(state.all_relevant) >= self.early_success:
                avg_conf = (
                    sum(c.get("grade_confidence", 0.0) for c in state.all_relevant)
                    / max(len(state.all_relevant), 1)
                )
                if avg_conf >= self.quality_threshold:
                    state.log_step(
                        "quality_gate",
                        decision="early_exit",
                        total_relevant=len(state.all_relevant),
                        avg_confidence=round(avg_conf, 2),
                    )
                    break

            # Decision: retry or give up?
            if attempt < self.max_retries:
                state.log_step(
                    "quality_gate",
                    decision="retry",
                    relevant=len(relevant),
                    attempt=attempt,
                )
                current_query = self._node_rewrite(state)
            else:
                state.log_step(
                    "quality_gate",
                    decision="exhausted",
                    total_relevant=len(state.all_relevant),
                )

    # ═══════════════════════════════════════════════════════════════════
    # MAIN GRAPH EXECUTION
    # ═══════════════════════════════════════════════════════════════════

    @traceable(name="agentic_rag.run", run_type="chain")
    def run(self, state: AgentState) -> AgentState:
        """
        Execute the full agentic decision graph.

        This is the BRAIN — it decides what to do at each step based
        on the current state, making the system truly autonomous.
        """
        # ── Step 1: Classify intent ──────────────────────────────────
        self._node_classify_intent(state)

        # ── Step 2: Route based on intent ────────────────────────────

        if state.intent == INTENT_DIRECT:
            self._node_direct_answer(state)
            return state

        if state.intent == INTENT_CLARIFY:
            self._node_request_clarification(state)
            return state

        if state.intent == INTENT_DECOMPOSE:
            # Decompose into sub-queries, retrieve each independently
            self._node_decompose(state)

            for sub_query in state.sub_queries:
                # Enhance each sub-query
                enhanced = self.query_enhancer.enhance(
                    sub_query, state.chat_history,
                )
                self._retrieval_loop(state, enhanced)

        else:
            # INTENT_RETRIEVE: standard single-query retrieval
            retrieval_query = state.enhanced_query or state.user_query
            self._retrieval_loop(state, retrieval_query)

        # ── Step 3: Post-retrieval decisions ─────────────────────────

        # Sort by confidence
        state.all_relevant.sort(
            key=lambda c: c.get("grade_confidence", 0.0), reverse=True,
        )

        # Check if we have ZERO results
        if not state.all_relevant:
            # Try clarification as a last resort
            state.used_fallback = True
            try:
                self._detect_clarification(state)
            except Exception:
                pass
            if not state.clarification:
                state.clarification = NO_RESULTS_MESSAGE
            state.log_step("fallback", reason="zero_relevant_chunks")
            return state

        # Mark best-effort if below minimum
        if len(state.all_relevant) < self.min_relevant:
            state.best_effort = True

        # ── Step 4: Generate answer ──────────────────────────────────
        # (done by pipeline.py using the generator — we return state
        #  with documents, and pipeline handles generation + streaming)

        state.log_step(
            "ready_for_generation",
            relevant_chunks=len(state.all_relevant),
            best_effort=state.best_effort,
        )

        return state

    @traceable(name="agentic_rag.post_generation_check", run_type="chain")
    def post_generation_check(self, state: AgentState) -> AgentState:
        """
        Called AFTER generation to verify groundedness.

        This is a separate method because generation is handled by
        the pipeline (which supports streaming). After the full
        answer is assembled, the pipeline calls this for verification.
        """
        if not state.answer or not state.all_relevant:
            return state

        self._node_hallucination_check(state)

        if not state.is_grounded and state.grounding_score < 0.4:
            # Severely ungrounded — add disclaimer
            state.answer += (
                "\n\n⚠️ *Note: Some details in this response may not be directly "
                "verified from the available documents. Please verify critical "
                "information with the university administration.*"
            )
            state.log_step(
                "hallucination_action",
                action="disclaimer_added",
                score=round(state.grounding_score, 2),
            )

        return state

    # ── Internal helpers ─────────────────────────────────────────────

    def _detect_clarification(self, state: AgentState) -> None:
        """Detect if user should be asked for more details."""
        if len(state.all_relevant) >= self.min_relevant:
            return

        try:
            found_summary = (
                "Nothing relevant found." if not state.all_relevant
                else "\n".join(
                    f"- {c.get('metadata', {}).get('source_file', 'Unknown')}: "
                    f"{c.get('text', '')[:100]}..."
                    for c in state.all_relevant[:3]
                )
            )
            irrelevant_reasons = "\n".join(
                f"- {c.get('grade_reason', 'N/A')}"
                for c in state.all_irrelevant[:5]
            )

            prompt = (
                f'A user asked: "{state.user_query}"\n\n'
                f"After multiple retrieval attempts in a university document system "
                f"(University of Education, Lahore), here's what we found:\n\n"
                f"Relevant results ({len(state.all_relevant)} chunks):\n{found_summary}\n\n"
                f"Common rejection reasons:\n{irrelevant_reasons}\n\n"
                f"Suggest 2-3 SPECIFIC follow-up questions or details the user could "
                f"provide to help find better results. Focus on:\n"
                f"- Missing specifics (program name, department, batch year, semester)\n"
                f"- Category confusion (BS/ADP vs MS/PhD vs Rules)\n"
                f"- Ambiguous terms that could mean different things\n\n"
                f"Return ONLY the bullet-point suggestions, nothing else. "
                f"Keep each suggestion under 20 words."
            )

            resp = self.client.chat.completions.create(
                model=AGENTIC_RAG_CONFIG["clarification_model"],
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150,
            )
            suggestions = resp.choices[0].message.content.strip()

            if suggestions:
                state.clarification = CLARIFICATION_MESSAGE_TEMPLATE.format(
                    suggestions=suggestions,
                )
        except Exception as exc:
            logger.warning("Clarification detection failed: %s", exc)


# ═════════════════════════════════════════════════════════════════════
# SINGLETON
# ═════════════════════════════════════════════════════════════════════

_graph: Optional[AgenticRAGGraph] = None


def get_agentic_graph(retriever, generator, query_enhancer, reranker=None) -> AgenticRAGGraph:
    """Get or create AgenticRAGGraph singleton."""
    global _graph
    if _graph is None:
        _graph = AgenticRAGGraph(retriever, generator, query_enhancer, reranker)
    return _graph
