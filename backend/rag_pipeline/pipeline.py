"""
RAG Pipeline Orchestrator

Main pipeline class that orchestrates all RAG components with short-term
conversation memory, streaming, LangSmith tracing, and Agentic RAG.

Agentic RAG (when enabled via ``enable_agentic=True``):
  1. Classify intent (DIRECT / RETRIEVE / DECOMPOSE / CLARIFY)
  2. For RETRIEVE: enhance → retrieve → rerank → grade → retry loop
  3. For DECOMPOSE: split into sub-queries, each through the retrieval loop
  4. For DIRECT: answer without document retrieval
  5. For CLARIFY: ask user for more specific details
  6. Post-generation hallucination check verifies grounding
  7. Full decision trail is returned for observability

When Agentic RAG is disabled the pipeline works as standard single-step RAG:
  retrieve → generate.
"""

import json
import time
import logging
from typing import Dict, List, Optional, Generator as Gen

from langsmith import traceable
from langsmith.run_helpers import get_current_run_tree
from .config import (
    NAMESPACE_MAP,
    DEFAULT_TOP_K_RETRIEVE,
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
)
from .query_enhancer import get_query_enhancer
from .retriever import get_retriever
from .generator import get_generator
from .memory import get_memory
from .agentic_rag import (
    get_agentic_graph,
    AgentState,
    AGENTIC_RAG_CONFIG,
)
from .agentic_rag.config import NO_RESULTS_MESSAGE

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# HELPER: build sources list from documents
# ═════════════════════════════════════════════════════════════════════════════

def _extract_sources(docs: List[Dict]) -> List[Dict]:
    sources = []
    for doc in docs:
        m = doc.get("metadata", {})
        sources.append({
            "file": m.get("source_file", "Unknown"),
            "page": m.get("page_number", "N/A"),
            "score": doc.get("score", 0),
            "course_code": m.get("course_code", ""),
            "department": m.get("department", ""),
        })
    return sources


# ═════════════════════════════════════════════════════════════════════════════
# RAG PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

class RAGPipeline:
    """Production RAG pipeline with namespace isolation, memory, streaming,
    and Agentic RAG (autonomous intent routing with self-correcting retrieval)."""

    def __init__(self):
        self.query_enhancer = get_query_enhancer()
        self.retriever = get_retriever()
        self.generator = get_generator()
        self.memory = get_memory()
        self.agentic_graph = get_agentic_graph(
            self.retriever, self.generator, self.query_enhancer,
        )

    # ── Namespace resolution ─────────────────────────────────────────

    def _resolve_namespace(self, namespace: str) -> str:
        if namespace in NAMESPACE_MAP:
            return NAMESPACE_MAP[namespace]
        if namespace in NAMESPACE_MAP.values():
            return namespace
        valid = list(NAMESPACE_MAP.keys())
        raise ValueError(f"Invalid namespace '{namespace}'. Valid options: {valid}")

    # ── Agentic retrieval ─────────────────────────────────────────────

    def _run_agentic(
        self,
        user_query: str,
        enhanced_query: str,
        pinecone_namespace: str,
        top_k: int,
        chat_history: List[Dict],
        session_id: str,
    ) -> AgentState:
        """Execute the full Agentic RAG graph and return the final state."""
        state = AgentState(
            user_query=user_query,
            namespace=pinecone_namespace,
            session_id=session_id,
            chat_history=chat_history,
            enhanced_query=enhanced_query,
            top_k=top_k,
        )
        state = self.agentic_graph.run(state)
        return state

    # ── NON-STREAMING QUERY ──────────────────────────────────────────

    @traceable(name="rag_pipeline.query", run_type="chain")
    def query(
        self, user_query: str, namespace: str, enhance_query: bool = True,
        top_k_retrieve: int = DEFAULT_TOP_K_RETRIEVE,
        session_id: str = "",
        enable_agentic: bool = False,
        chat_history: List[Dict[str, str]] | None = None,
    ) -> Dict:
        """Execute the full RAG pipeline (non-streaming)."""
        t_start = time.perf_counter()
        pinecone_namespace = self._resolve_namespace(namespace)

        # For the aggregated about-university knowledge base, pull a broader set
        # of chunks to capture full department lists and campus info.
        if pinecone_namespace == "about-university":
            top_k_retrieve = max(top_k_retrieve, 18)

        # Prefer explicit history from the client (e.g., when resuming a saved chat).
        # Fall back to session memory if none is provided.
        if chat_history is None:
            chat_history = []
            if session_id:
                chat_history = self.memory.get_history(session_id)

        # ── Query enhancement ────────────────────────────────────
        enhanced_query = user_query
        agentic_info = None

        if enhance_query:
            t_enhance = time.perf_counter()
            enhanced_query = self.query_enhancer.enhance(user_query, chat_history=chat_history)
            logger.info("⏱ enhance: %.2fs", time.perf_counter() - t_enhance)

        # The retrieval query: use enhanced if available, else raw
        retrieval_query = enhanced_query

        if enable_agentic:
            # AGENTIC PATH: autonomous decision graph
            state = self._run_agentic(
                user_query, retrieval_query, pinecone_namespace,
                top_k_retrieve, chat_history, session_id,
            )
            agentic_info = state.build_agentic_info()

            # Handle DIRECT intent (no documents needed)
            if state.direct_response:
                if session_id:
                    self.memory.add_turn(session_id, user_query, state.direct_response)
                _run_id = None
                try:
                    _rt = get_current_run_tree()
                    if _rt:
                        _run_id = str(_rt.id)
                except Exception:
                    pass
                return {
                    "answer": state.direct_response, "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace, "session_id": session_id,
                    "agentic_info": agentic_info,
                    "run_id": _run_id,
                }

            # Handle CLARIFY intent or zero-chunk fallback
            if state.used_fallback or (state.clarification and not state.all_relevant):
                fallback = state.clarification or NO_RESULTS_MESSAGE
                if session_id:
                    self.memory.add_turn(session_id, user_query, fallback)
                _run_id = None
                try:
                    _rt = get_current_run_tree()
                    if _rt:
                        _run_id = str(_rt.id)
                except Exception:
                    pass
                return {
                    "answer": fallback, "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace, "session_id": session_id,
                    "agentic_info": agentic_info,
                    "run_id": _run_id,
                }

            # Use the relevant documents from the agentic graph
            documents = state.all_relevant
        else:
            # STANDARD PATH: single retrieval (ensemble: dense + BM25 via RRF)
            t_retrieve = time.perf_counter()
            documents = self.retriever.ensemble_retrieve(
                query=retrieval_query, namespace=pinecone_namespace, top_k=top_k_retrieve,
            )
            logger.info("⏱ retrieve: %.2fs  (docs=%d)", time.perf_counter() - t_retrieve, len(documents))

        if not documents:
            no_result = (
                "No relevant documents found for your query in this namespace. "
                "Please try rephrasing or check if you selected the correct category."
            )
            if session_id:
                self.memory.add_turn(session_id, user_query, no_result)
            _run_id = None
            try:
                _rt = get_current_run_tree()
                if _rt:
                    _run_id = str(_rt.id)
            except Exception:
                pass
            return {
                "answer": no_result, "sources": [],
                "enhanced_query": enhanced_query,
                "namespace": namespace, "session_id": session_id,
                "agentic_info": agentic_info,
                "run_id": _run_id,
            }

        # ── Use retrieved documents directly (top_k already applied by retriever) ──
        final_docs = documents[:top_k_retrieve]

        # ── Generate ────────────────────────────────────────────────
        t_generate = time.perf_counter()
        answer = self.generator.generate(
            query=user_query, documents=final_docs, namespace=pinecone_namespace,
            chat_history=chat_history, session_id=session_id, enhanced_query=enhanced_query,
        )
        logger.info("⏱ generate: %.2fs", time.perf_counter() - t_generate)

        # ── Post-generation hallucination check (agentic only) ───────
        if enable_agentic and state is not None:
            state.answer = answer
            state = self.agentic_graph.post_generation_check(state)
            answer = state.answer  # May include disclaimer
            agentic_info = state.build_agentic_info()  # Refresh with hallucination data

        if session_id:
            self.memory.add_turn(session_id, user_query, answer)

        sources = _extract_sources(final_docs)

        # ── Capture LangSmith run_id for feedback linkage ────────
        run_id = None
        try:
            rt = get_current_run_tree()
            if rt:
                run_id = str(rt.id)
        except Exception:
            pass

        latency_ms = (time.perf_counter() - t_start) * 1000
        logger.info("⏱ TOTAL: %.2fs", latency_ms / 1000)

        return {
            "answer": answer, "sources": sources,
            "enhanced_query": enhanced_query,
            "namespace": namespace, "session_id": session_id,
            "agentic_info": agentic_info,
            "run_id": run_id,
        }

    # ── STREAMING QUERY ──────────────────────────────────────────────

    @traceable(name="rag_pipeline.stream_query", run_type="chain")
    def stream_query(
        self, user_query: str, namespace: str, enhance_query: bool = True,
        top_k_retrieve: int = DEFAULT_TOP_K_RETRIEVE,
        session_id: str = "",
        enable_agentic: bool = False,
        chat_history: List[Dict[str, str]] | None = None,
    ) -> Gen[Dict, None, None]:
        """Execute RAG pipeline with streaming token output."""
        t_start = time.perf_counter()
        pinecone_namespace = self._resolve_namespace(namespace)

        if pinecone_namespace == "about-university":
            top_k_retrieve = max(top_k_retrieve, 18)

        if chat_history is None:
            chat_history = []
            if session_id:
                chat_history = self.memory.get_history(session_id)

        # ── Query enhancement ────────────────────────────────────
        enhanced_query = user_query
        agentic_info = None
        state = None

        if enhance_query:
            t_enhance = time.perf_counter()
            enhanced_query = self.query_enhancer.enhance(user_query, chat_history=chat_history)
            logger.info("⏱ enhance: %.2fs", time.perf_counter() - t_enhance)

        # The retrieval query: use enhanced if available, else raw
        retrieval_query = enhanced_query

        if enable_agentic:
            # AGENTIC PATH: autonomous decision graph
            state = self._run_agentic(
                user_query, retrieval_query, pinecone_namespace,
                top_k_retrieve, chat_history, session_id,
            )
            agentic_info = state.build_agentic_info()

            # Handle DIRECT intent
            if state.direct_response:
                if session_id:
                    self.memory.add_turn(session_id, user_query, state.direct_response)
                _run_id = None
                try:
                    _rt = get_current_run_tree()
                    if _rt:
                        _run_id = str(_rt.id)
                except Exception:
                    pass
                yield {
                    "type": "metadata", "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace, "session_id": session_id,
                    "agentic_info": agentic_info,
                    "run_id": _run_id,
                }
                yield {"type": "token", "content": state.direct_response}
                return

            # Handle CLARIFY / fallback
            if state.used_fallback or (state.clarification and not state.all_relevant):
                fallback = state.clarification or NO_RESULTS_MESSAGE
                if session_id:
                    self.memory.add_turn(session_id, user_query, fallback)
                _run_id = None
                try:
                    _rt = get_current_run_tree()
                    if _rt:
                        _run_id = str(_rt.id)
                except Exception:
                    pass
                yield {
                    "type": "metadata", "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace, "session_id": session_id,
                    "agentic_info": agentic_info,
                    "run_id": _run_id,
                }
                yield {"type": "token", "content": fallback}
                return

            documents = state.all_relevant
        else:
            # STANDARD PATH: single retrieval (ensemble: dense + BM25 via RRF)
            t_retrieve = time.perf_counter()
            documents = self.retriever.ensemble_retrieve(
                query=retrieval_query, namespace=pinecone_namespace, top_k=top_k_retrieve,
            )
            logger.info("⏱ retrieve: %.2fs  (docs=%d)", time.perf_counter() - t_retrieve, len(documents))

        if not documents:
            no_result = (
                "No relevant documents found for your query in this namespace. "
                "Please try rephrasing or check if you selected the correct category."
            )
            if session_id:
                self.memory.add_turn(session_id, user_query, no_result)
            _run_id = None
            try:
                _rt = get_current_run_tree()
                if _rt:
                    _run_id = str(_rt.id)
            except Exception:
                pass
            yield {
                "type": "metadata", "sources": [],
                "enhanced_query": enhanced_query,
                "namespace": namespace, "session_id": session_id,
                "agentic_info": agentic_info,
                "run_id": _run_id,
            }
            yield {"type": "token", "content": no_result}
            return

        # ── Use retrieved documents directly (top_k already applied by retriever) ──
        final_docs = documents[:top_k_retrieve]

        sources = _extract_sources(final_docs)

        # ── Capture LangSmith run_id for feedback linkage ────────
        run_id = None
        try:
            rt = get_current_run_tree()
            if rt:
                run_id = str(rt.id)
        except Exception:
            pass

        # ── Emit metadata first ─────────────────────────────────────
        yield {
            "type": "metadata", "sources": sources,
            "enhanced_query": enhanced_query,
            "namespace": namespace, "session_id": session_id,
            "agentic_info": agentic_info,
            "run_id": run_id,
        }

        # ── Stream tokens ───────────────────────────────────────────
        full_answer_parts = []
        for token in self.generator.generate_stream(
            query=user_query, documents=final_docs, namespace=pinecone_namespace,
            chat_history=chat_history, session_id=session_id, enhanced_query=enhanced_query,
        ):
            full_answer_parts.append(token)
            yield {"type": "token", "content": token}

        full_answer = "".join(full_answer_parts)

        # ── Post-generation hallucination check (agentic only) ───────
        if enable_agentic and state is not None:
            state.answer = full_answer
            state = self.agentic_graph.post_generation_check(state)
            agentic_info = state.build_agentic_info()

            # If answer was modified (disclaimer added), emit the extra text
            if state.answer != full_answer:
                extra = state.answer[len(full_answer):]
                if extra:
                    yield {"type": "token", "content": extra}
                full_answer = state.answer

            # Emit updated agentic_info after hallucination check
            yield {
                "type": "agentic_update",
                "agentic_info": agentic_info,
            }

        if session_id:
            self.memory.add_turn(session_id, user_query, full_answer)

        latency_ms = (time.perf_counter() - t_start) * 1000
        logger.info("⏱ TOTAL: %.2fs", latency_ms / 1000)


# ═════════════════════════════════════════════════════════════════════════════
# SINGLETON
# ═════════════════════════════════════════════════════════════════════════════

_pipeline: Optional[RAGPipeline] = None


def get_pipeline() -> RAGPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
    return _pipeline
