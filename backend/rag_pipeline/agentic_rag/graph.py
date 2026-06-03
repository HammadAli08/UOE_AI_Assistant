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
from .utils import apply_grounding_disclaimer

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

    def __init__(self, retriever, generator, query_enhancer):
        # Injected pipeline components
        self.retriever = retriever
        self.generator = generator
        self.query_enhancer = query_enhancer

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
        self.llm_timeout = AGENTIC_RAG_CONFIG["llm_timeout"]

    # ═══════════════════════════════════════════════════════════════════
    # GRAPH NODES
    # ═══════════════════════════════════════════════════════════════════

    def _node_classify_intent(self, state: AgentState) -> None:
        """Node 1: Classify user intent.

        Unpacks the (intent, fast_response, suggested_namespace) tuple
        from the classifier and stores everything on the per-request
        AgentState — never on the singleton classifier instance.
        """
        intent, fast_response, suggested_ns = self.intent_classifier.classify(
            state.user_query, state.chat_history,
        )
        state.intent = intent
        state.fast_response = fast_response
        state.suggested_namespace = suggested_ns
        state.log_step(
            "classify_intent",
            intent=state.intent,
            suggested_namespace=suggested_ns,
        )

    def _node_direct_answer(self, state: AgentState) -> None:
        """Node: Answer directly without retrieval (greetings, meta questions)."""
        # ── Fast-path: Use pre-defined response from classifier ───────────
        if state.fast_response:
            state.direct_response = state.fast_response
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
                timeout=self.llm_timeout,
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
                timeout=self.llm_timeout,
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

    def _node_retrieve(self, state: AgentState, query: str, attempt: int, namespace: Optional[str] = None) -> List[Dict]:
        """Node: Retrieve documents for a single query.

        Args:
            state:     The agent state.
            query:     The query to retrieve for.
            attempt:   Current retry attempt (0-indexed).
            namespace: Override namespace. If None, uses state.namespace.
        """
        retrieve_k = state.top_k + (self.retry_boost * attempt)
        ns = namespace or state.namespace
        
        if state.filter_stages:
            documents, filter_used, quality = self.retriever.filtered_retrieve(
                query=query,
                namespace=ns,
                filter_stages=state.filter_stages,
                top_k=retrieve_k,
            )
            state.log_step(
                "filtered_retrieve",
                query=query[:80],
                attempt=attempt,
                docs_found=len(documents),
                top_k=retrieve_k,
                quality=quality,
                filter_used=filter_used,
                namespace=ns,
            )
        else:
            documents = self.retriever.ensemble_retrieve(
                query=query,
                namespace=ns,
                top_k=retrieve_k,
            )
            state.log_step(
                "retrieve",
                query=query[:80],
                attempt=attempt,
                docs_found=len(documents),
                top_k=retrieve_k,
                namespace=ns,
            )
            
        state.total_retrievals += 1
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

    def _node_rewrite(self, state: AgentState, current_query: str, irrelevant_docs: List[Dict], attempt: int) -> str:
        """Node: Rewrite the query for retry."""
        rewritten = self.rewriter.rewrite(
            current_query, irrelevant_docs, attempt,
        )
        state.query_rewrites.append({
            "attempt": attempt,
            "rewritten_query": rewritten,
        })
        state.log_step(
            "rewrite",
            attempt=attempt,
            original=current_query[:60],
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
        Uses grade→rewrite→retry pattern.
        """
        current_query = query

        for attempt in range(self.max_retries + 1):
            state.attempt = attempt  # Kept for standard path

            # Retrieve
            documents = self._node_retrieve(state, current_query, attempt)
            if not documents:
                if attempt < self.max_retries:
                    current_query = self._node_rewrite(state, state.user_query, state.all_irrelevant, attempt)
                    continue
                break

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
                current_query = self._node_rewrite(state, state.user_query, state.all_irrelevant, attempt)
            else:
                state.log_step(
                    "quality_gate",
                    decision="exhausted",
                    total_relevant=len(state.all_relevant),
                )

    def _isolated_retrieval_loop(
        self,
        state: AgentState,
        sub_query_id: str,
        query: str,
        namespace: str,
    ) -> None:
        """
        Isolated self-correcting retrieval loop for a sub-query.
        Stores results strictly within state.sub_query_results.

        Args:
            state:        The shared agent state (only sub_query_results is written).
            sub_query_id: Identifier like "Q1", "Q2".
            query:        The sub-query text.
            namespace:    The namespace to retrieve from (passed as parameter,
                          never mutated on state — safe for concurrent threads).
        """
        current_query = query
        all_relevant = []
        all_irrelevant = []
        seen_ids = set()

        for attempt in range(self.max_retries + 1):
            documents = self._node_retrieve(state, current_query, attempt, namespace=namespace)
            if not documents:
                if attempt < self.max_retries:
                    current_query = self._node_rewrite(state, query, all_irrelevant, attempt)
                    continue
                break

            relevant, irrelevant = self._node_grade(state, documents)

            for chunk in relevant:
                chunk_id = chunk.get("id", id(chunk))
                if chunk_id not in seen_ids:
                    seen_ids.add(chunk_id)
                    all_relevant.append(chunk)
            all_irrelevant.extend(irrelevant)

            if len(relevant) >= self.min_relevant:
                avg_conf = sum(c.get("grade_confidence", 0.0) for c in relevant) / max(len(relevant), 1)
                if avg_conf >= self.quality_threshold:
                    state.log_step(f"quality_gate_{sub_query_id}", decision="pass", relevant=len(relevant))
                    break

            if len(all_relevant) >= self.early_success:
                avg_conf = sum(c.get("grade_confidence", 0.0) for c in all_relevant) / max(len(all_relevant), 1)
                if avg_conf >= self.quality_threshold:
                    state.log_step(f"quality_gate_{sub_query_id}", decision="early_exit", total_relevant=len(all_relevant))
                    break

            if attempt < self.max_retries:
                state.log_step(f"quality_gate_{sub_query_id}", decision="retry", attempt=attempt)
                current_query = self._node_rewrite(state, query, all_irrelevant, attempt)
            else:
                state.log_step(f"quality_gate_{sub_query_id}", decision="exhausted", total_relevant=len(all_relevant))

        # Store isolated state
        best_effort = len(all_relevant) < self.min_relevant
        # Sort relevant chunks for this isolated query
        all_relevant.sort(key=lambda c: c.get("grade_confidence", 0.0), reverse=True)
        # Force limit the isolated chunk window to max top_k docs so it doesn't leak memory and scales
        state.sub_query_results[sub_query_id] = {
            "all_relevant": all_relevant[: state.top_k],
            "all_irrelevant": all_irrelevant,
            "final_query": current_query,
            "best_effort": best_effort,
            "is_grounded": True,
            "grounding_score": 1.0,
            "answer": "",
            "namespace_used": namespace,
        }

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
            # Decompose into sub-queries structured elements
            self._node_decompose(state)

            import concurrent.futures

            def process_sub_query(sq_dict: Dict[str, str]) -> None:
                sq_id = sq_dict.get("id")
                sq_query = sq_dict.get("query")
                if not sq_id or not sq_query:
                    return

                # Determine namespace: use sub-query hint if available,
                # fall back to classifier suggestion, then top-level namespace.
                sq_namespace = (
                    sq_dict.get("namespace_hint")
                    or state.suggested_namespace
                    or state.namespace
                )

                enhanced = self.query_enhancer.enhance(sq_query, state.chat_history)
                self._isolated_retrieval_loop(state, sq_id, enhanced, namespace=sq_namespace)

            # Launch parallel threads 
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(state.sub_queries) or 1) as executor:
                executor.map(process_sub_query, state.sub_queries)
            
            # Sub-queries isolated evaluation completed here. Pipeline handles generation natively.
            state.log_step("decompose_retrieval_completed", results_keys=list(state.sub_query_results.keys()))

            # Check if all isolated loops failed
            total_relevant_across_all = sum(len(r["all_relevant"]) for r in state.sub_query_results.values())
            if not total_relevant_across_all:
                state.used_fallback = True
                state.clarification = NO_RESULTS_MESSAGE
            
            return state

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

        Uses the three-tier grounding system:
          score >= 0.75  → grounded   — pass as-is
          0.40 <= score  → partial    — soft warning
          score < 0.40   → ungrounded — strong disclaimer
        """
        if not state.answer or not state.all_relevant:
            return state

        self._node_hallucination_check(state)

        # Apply three-tier disclaimer using shared utility
        state.answer = apply_grounding_disclaimer(state.answer, state.grounding_score)

        if state.grounding_score < AGENTIC_RAG_CONFIG["hallucination_threshold"]:
            state.log_step(
                "hallucination_action",
                action="disclaimer_added",
                tier="partial" if state.grounding_score >= AGENTIC_RAG_CONFIG["hallucination_partial_threshold"] else "ungrounded",
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
                timeout=self.llm_timeout,
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


def get_agentic_graph(retriever, generator, query_enhancer) -> AgenticRAGGraph:
    """Get or create AgenticRAGGraph singleton."""
    global _graph
    if _graph is None:
        _graph = AgenticRAGGraph(retriever, generator, query_enhancer)
    return _graph
