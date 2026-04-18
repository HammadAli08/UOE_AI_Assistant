"""
RAG Pipeline Orchestrator

Main pipeline class that orchestrates all RAG components with short-term
conversation memory, streaming, LangSmith tracing, and optional Smart RAG.

Smart RAG (when enabled via ``enable_smart=True``):
  1. Enhance the query, retrieve chunks from vector DB
  2. LLM grades every chunk for relevance
  3. If chunks are good enough → generate answer
  4. If not → rewrite query and re-retrieve (up to 6 retries)
  5. Accumulates ALL relevant chunks found across every iteration
  6. Early exit when enough high-quality chunks collected
  7. After 3 retries → answer with ALL relevant chunks collected (best-effort)
  8. If very few chunks → detect if clarification from user would help
  9. Only uses "sorry" fallback when literally zero chunks exist

When Smart RAG is disabled the pipeline works as standard single-step RAG:
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
    FILTER_ENABLED_NAMESPACES,
)
from .query_enhancer import get_query_enhancer
from .query_filter_parser import get_query_filter_parser
from .retriever import get_retriever
from .generator import get_generator
from .memory import get_memory
from .agentic_rag import AgentState, get_agentic_graph

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# HELPER: build sources list from documents
# ═════════════════════════════════════════════════════════════════════════════

import re

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

def _handle_chitchat(query: str) -> Optional[str]:
    q = query.lower().strip()
    q = re.sub(r'[^\w\s]', '', q)
    if q in ["hi", "hello", "hey", "greetings", "salam", "assalam o alaikum", "assalamualaikum"]:
        return "Hello! How can I help you today?"
    if q in ["how are you", "how are you doing", "whats up"]:
        return "I am all good! How can I help you?"
    if q in ["who are you", "what are you"]:
        return "I am the UOE AI Assistant. I can help you with queries related to university admissions, scheme of studies, and regulations."
    if q in ["thank you", "thanks", "ok", "okay", "great", "nice", "good"]:
        return "You're welcome! Let me know if you need anything else."
    return None


# ═════════════════════════════════════════════════════════════════════════════
# RAG PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

class RAGPipeline:
    """Production RAG pipeline with namespace isolation, memory, streaming,
    and agentic RAG (intent routing, decomposition, hallucination guard)."""

    def __init__(self):
        self.query_enhancer = get_query_enhancer()
        self.filter_parser = get_query_filter_parser()
        self.retriever = get_retriever()
        self.generator = get_generator()
        self.memory = get_memory()
        self.agentic_graph = get_agentic_graph(
            self.retriever, self.generator, self.query_enhancer
        )

    # ── Namespace resolution ─────────────────────────────────────────

    def _resolve_namespace(self, namespace: str) -> str:
        if namespace in NAMESPACE_MAP:
            return NAMESPACE_MAP[namespace]
        if namespace in NAMESPACE_MAP.values():
            return namespace
        valid = list(NAMESPACE_MAP.keys())
        raise ValueError(f"Invalid namespace '{namespace}'. Valid options: {valid}")

    def _resolve_chat_history(
        self,
        session_id: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, str]]:
        """Prefer explicit history; otherwise read from session memory."""
        if chat_history is not None:
            return chat_history
        if session_id:
            return self.memory.get_history(session_id)
        return []

    # ── Smart retrieval loop (best-effort) ────────────────────

    @traceable(name="rag_pipeline.smart_retrieve", run_type="chain")
    def _smart_retrieve(
        self,
        user_query: str,
        enhanced_query: str,
        pinecone_namespace: str,
        top_k: int,
    ) -> Dict:
        """
        Self-correcting retrieval with best-effort answering:
          attempt 0  → retrieve with enhanced_query, grade chunks
          attempt 1+ → rewrite query, retrieve again, grade again
          After 3 retries → answer with ALL relevant chunks collected
          If few chunks → check if user should provide more details
          Zero chunks ever → return fallback "sorry" message

        Returns dict with keys: documents, metrics, query_used, clarification
        """
        proc = self.smart_processor
        max_retries = SMART_RAG_CONFIG["max_retries"]
        boost = SMART_RAG_CONFIG["retry_top_k_boost"]

        current_query = enhanced_query
        all_relevant: List[Dict] = []  # Accumulate across ALL attempts
        all_irrelevant: List[Dict] = []
        total_retrievals = 0
        total_graded = 0
        rewrites: List[Dict] = []
        seen_ids = set()  # Deduplicate chunks across attempts

        for attempt in range(max_retries + 1):
            # Retrieve — use more chunks on retries (progressively)
            retrieve_k = top_k + (boost * attempt)
            documents = self.retriever.ensemble_retrieve(
                query=current_query, namespace=pinecone_namespace, top_k=retrieve_k,
            )
            total_retrievals += 1

            if not documents:
                logger.info("Smart attempt %d: zero documents retrieved", attempt)
                if attempt < max_retries:
                    current_query = proc.rewrite_query(user_query, all_irrelevant, attempt + 1)
                    rewrites.append({"attempt": attempt + 1, "rewritten_query": current_query})
                    continue
                break

            # Grade against user's original question (not enhanced/rewritten)
            # so grading matches user intent, not search-expanded terms
            relevant, irrelevant = proc.grade_chunks(user_query, documents)
            total_graded += len(documents)

            # Accumulate relevant chunks (deduplicate by ID)
            for chunk in relevant:
                chunk_id = chunk.get("id", id(chunk))
                if chunk_id not in seen_ids:
                    seen_ids.add(chunk_id)
                    all_relevant.append(chunk)

            all_irrelevant.extend(irrelevant)

            logger.info(
                "Smart attempt %d: retrieved=%d, relevant=%d, irrelevant=%d, "
                "total_relevant=%d, query='%s'",
                attempt, len(documents), len(relevant), len(irrelevant),
                len(all_relevant), current_query[:80],
            )

            # Per-attempt quality gate: this attempt had enough high-quality chunks?
            if not proc.should_retry(relevant, attempt):
                logger.info(
                    "Smart RAG: attempt %d passed quality gate "
                    "(relevant=%d, min=%d) — stopping",
                    attempt, len(relevant), proc.min_relevant,
                )
                break

            # Cross-attempt check: accumulated enough high-quality chunks overall?
            if proc.should_stop_early(all_relevant, attempt):
                logger.info(
                    "Smart RAG early exit: %d relevant chunks accumulated "
                    "with sufficient quality (threshold=%d)",
                    len(all_relevant), proc.early_success,
                )
                break

            # Rewrite for the next attempt
            current_query = proc.rewrite_query(user_query, irrelevant, attempt + 1)
            rewrites.append({"attempt": attempt + 1, "rewritten_query": current_query})

        # ── Post-loop: clarification detection ───────────────────────
        clarification = None
        if len(all_relevant) == 0:
            # Zero chunks: check if we should ask for clarification
            clarification = proc.detect_clarification_needed(
                user_query, all_relevant, all_irrelevant,
            )
        elif len(all_relevant) < proc.min_relevant:
            # Very few chunks: might benefit from user details
            clarification = proc.detect_clarification_needed(
                user_query, all_relevant, all_irrelevant,
            )

        # Best-effort: use ALL relevant chunks collected across attempts
        # Sort by grade_confidence descending so best chunks are fed to generator first
        all_relevant.sort(
            key=lambda c: c.get("grade_confidence", 0.0), reverse=True,
        )

        is_best_effort = (
            len(all_relevant) > 0
            and len(all_relevant) < proc.min_relevant
        )

        metrics = proc.build_metrics(
            total_retrievals=total_retrievals,
            total_chunks_graded=total_graded,
            query_rewrites=rewrites,
            final_relevant_count=len(all_relevant),
            used_fallback=len(all_relevant) == 0,
            best_effort=is_best_effort,
            clarification_asked=clarification is not None,
        )

        logger.info("Smart RAG metrics: %s", json.dumps(metrics))

        return {
            "documents": all_relevant,
            "metrics": metrics,
            "query_used": current_query,
            "clarification": clarification,
        }

    # ── NON-STREAMING QUERY ──────────────────────────────────────────

    @traceable(name="rag_pipeline.query", run_type="chain")
    def query(
        self, user_query: str, namespace: str, enhance_query: bool = True,
        top_k_retrieve: int = DEFAULT_TOP_K_RETRIEVE,
        session_id: str = "",
        enable_smart: bool = False,
        enable_agentic: bool = False,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict:
        """Execute the full RAG pipeline (non-streaming)."""
        t_start = time.perf_counter()
        pinecone_namespace = self._resolve_namespace(namespace)

        chat_history = self._resolve_chat_history(session_id, chat_history)

        chitchat_response = _handle_chitchat(user_query)
        if chitchat_response:
            if session_id:
                self.memory.add_turn(session_id, user_query, chitchat_response)
            return {
                "answer": chitchat_response, "sources": [],
                "enhanced_query": user_query,
                "namespace": namespace, "session_id": session_id,
                "smart_info": None, "agentic_info": None, "run_id": None,
            }

        # ── Query enhancement ────────────────────────────────────
        enhanced_query = user_query
        smart_info = None
        agentic_info = None
        agentic_state = None

        if enhance_query:
            t_enhance = time.perf_counter()
            enhanced_query = self.query_enhancer.enhance(user_query, chat_history=chat_history)
            logger.info("⏱ enhance: %.2fs", time.perf_counter() - t_enhance)

        # The retrieval query: use enhanced if available, else raw
        retrieval_query = enhanced_query

        # ── Metadata filter parsing (rule-based, zero latency) ────
        parsed_query = None
        filter_info = None
        if pinecone_namespace in FILTER_ENABLED_NAMESPACES:
            parsed_query = self.filter_parser.parse(user_query, pinecone_namespace)
            if parsed_query.has_filters:
                filter_info = {
                    "parsed": repr(parsed_query),
                    "confidence": parsed_query.confidence,
                    "matched_rules": parsed_query.matched_rules,
                    "filter": parsed_query.to_pinecone_filter(),
                }
                logger.info("🎯 Filter parsed: %s", filter_info["parsed"])

        if enable_agentic:
            # AGENTIC PATH: autonomous intent routing + retrieval + grounding checks
            agentic_state = AgentState(
                user_query=user_query,
                namespace=pinecone_namespace,
                session_id=session_id,
                chat_history=chat_history,
                enhanced_query=retrieval_query,
                top_k=top_k_retrieve,
                current_query=retrieval_query,
                filter_stages=parsed_query.relaxed_filters() if parsed_query else [],
            )
            agentic_state = self.agentic_graph.run(agentic_state)
            agentic_info = agentic_state.build_agentic_info()

            if agentic_state.direct_response:
                answer = agentic_state.direct_response
                if session_id:
                    self.memory.add_turn(session_id, user_query, answer)
                run_id = None
                try:
                    rt = get_current_run_tree()
                    if rt:
                        run_id = str(rt.id)
                except Exception:
                    pass
                return {
                    "answer": answer,
                    "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace,
                    "session_id": session_id,
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "filter_info": filter_info,
                    "run_id": run_id,
                }

            if agentic_state.clarification and not agentic_state.all_relevant:
                fallback = agentic_state.clarification
                if session_id:
                    self.memory.add_turn(session_id, user_query, fallback)
                run_id = None
                try:
                    rt = get_current_run_tree()
                    if rt:
                        run_id = str(rt.id)
                except Exception:
                    pass
                return {
                    "answer": fallback,
                    "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace,
                    "session_id": session_id,
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "filter_info": filter_info,
                    "run_id": run_id,
                }

            if agentic_state.intent == "DECOMPOSE":
                documents = []
                for sq in agentic_state.sub_query_results.values():
                    documents.extend(sq["all_relevant"])
            else:
                documents = agentic_state.all_relevant
        elif enable_smart:
            # SMART PATH: self-correcting retrieval loop
            smart_result = self._smart_retrieve(
                user_query, retrieval_query, pinecone_namespace, top_k_retrieve,
            )
            documents = smart_result["documents"]
            smart_info = smart_result["metrics"]
            clarification = smart_result.get("clarification")

            # Fallback only when zero chunks across all attempts
            if not documents:
                # Use clarification message if available, else generic fallback
                fallback = clarification or get_smart_fallback_message()
                if session_id:
                    self.memory.add_turn(session_id, user_query, fallback)
                # Capture run_id even on fallback
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
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "run_id": _run_id,
                }
        else:
            # STANDARD PATH: filter-first retrieval when filters available
            t_retrieve = time.perf_counter()
            if parsed_query and parsed_query.has_filters:
                documents, filter_used, retrieval_quality = self.retriever.filtered_retrieve(
                    query=retrieval_query,
                    namespace=pinecone_namespace,
                    filter_stages=parsed_query.relaxed_filters(),
                    top_k=top_k_retrieve,
                )
                if filter_info:
                    filter_info["quality"] = retrieval_quality
                    filter_info["filter_used"] = filter_used
                logger.info(
                    "⏱ filtered_retrieve: %.2fs  (docs=%d, quality=%s)",
                    time.perf_counter() - t_retrieve, len(documents), retrieval_quality,
                )
            else:
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
                "smart_info": smart_info,
                "agentic_info": agentic_info,
                "filter_info": filter_info,
                "run_id": _run_id,
            }

        # ── Generate ────────────────────────────────────────────────
        t_generate = time.perf_counter()
        
        if enable_agentic and agentic_state is not None and agentic_state.intent == "DECOMPOSE":
            full_answer_parts = []
            final_sources = []
            for sq_id, sq_data in agentic_state.sub_query_results.items():
                sq_query = sq_data["final_query"]
                sq_docs = sq_data["all_relevant"]
                if not sq_docs:
                    part_ans = f"**{sq_query}**\nSorry, insufficient data available to answer this part."
                else:
                    ans = self.generator.generate(
                        query=sq_query, documents=sq_docs, namespace=pinecone_namespace,
                        chat_history=chat_history, session_id=session_id, enhanced_query=sq_query,
                    )
                    # Isolated hallucination check per sub-query
                    is_grnd, score, claims = self.agentic_graph.hallucination_guard.check(ans, sq_docs)
                    if not is_grnd and score < 0.4:
                        ans += "\n\n⚠️ *Note: Some details may not be directly verified from available documents.*"
                    part_ans = f"**{sq_query}**\n{ans}"
                    final_sources.extend(_extract_sources(sq_docs))
                full_answer_parts.append(part_ans)
                
            answer = "\n\n---\n\n".join(full_answer_parts)
            sources = final_sources
            agentic_state.answer = answer
            agentic_state.sources = sources
            agentic_info = agentic_state.build_agentic_info()
            
        else:
            final_docs = documents[:top_k_retrieve]
            answer = self.generator.generate(
                query=user_query, documents=final_docs, namespace=pinecone_namespace,
                chat_history=chat_history, session_id=session_id, enhanced_query=enhanced_query,
            )
            sources = _extract_sources(final_docs)
            if enable_agentic and agentic_state is not None:
                agentic_state.answer = answer
                agentic_state.sources = sources
                agentic_state = self.agentic_graph.post_generation_check(agentic_state)
                answer = agentic_state.answer
                agentic_info = agentic_state.build_agentic_info()

        logger.info("⏱ generate: %.2fs", time.perf_counter() - t_generate)

        if session_id:
            self.memory.add_turn(session_id, user_query, answer)

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
            "smart_info": smart_info,
            "agentic_info": agentic_info,
            "filter_info": filter_info,
            "run_id": run_id,
        }

    # ── STREAMING QUERY ──────────────────────────────────────────────

    @traceable(name="rag_pipeline.stream_query", run_type="chain")
    def stream_query(
        self, user_query: str, namespace: str, enhance_query: bool = True,
        top_k_retrieve: int = DEFAULT_TOP_K_RETRIEVE,
        session_id: str = "",
        enable_smart: bool = False,
        enable_agentic: bool = False,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> Gen[Dict, None, None]:
        """Execute RAG pipeline with streaming token output."""
        t_start = time.perf_counter()
        pinecone_namespace = self._resolve_namespace(namespace)

        chat_history = self._resolve_chat_history(session_id, chat_history)

        chitchat_response = _handle_chitchat(user_query)
        if chitchat_response:
            if session_id:
                self.memory.add_turn(session_id, user_query, chitchat_response)
            yield {
                "type": "metadata", "sources": [],
                "enhanced_query": user_query,
                "namespace": namespace, "session_id": session_id,
                "smart_info": None, "agentic_info": None, "run_id": None,
            }
            yield {"type": "token", "content": chitchat_response}
            return

        # ── Query enhancement ────────────────────────────────────
        enhanced_query = user_query
        smart_info = None
        agentic_info = None
        agentic_state = None

        if enhance_query:
            t_enhance = time.perf_counter()
            enhanced_query = self.query_enhancer.enhance(user_query, chat_history=chat_history)
            logger.info("⏱ enhance: %.2fs", time.perf_counter() - t_enhance)

        # The retrieval query: use enhanced if available, else raw
        retrieval_query = enhanced_query

        # ── Metadata filter parsing (rule-based, zero latency) ────
        parsed_query = None
        filter_info = None
        if pinecone_namespace in FILTER_ENABLED_NAMESPACES:
            parsed_query = self.filter_parser.parse(user_query, pinecone_namespace)
            if parsed_query.has_filters:
                filter_info = {
                    "parsed": repr(parsed_query),
                    "confidence": parsed_query.confidence,
                    "matched_rules": parsed_query.matched_rules,
                    "filter": parsed_query.to_pinecone_filter(),
                }
                logger.info("🎯 [stream] Filter parsed: %s", filter_info["parsed"])

        if enable_agentic:
            # AGENTIC PATH: autonomous intent routing + retrieval + grounding checks
            agentic_state = AgentState(
                user_query=user_query,
                namespace=pinecone_namespace,
                session_id=session_id,
                chat_history=chat_history,
                enhanced_query=retrieval_query,
                top_k=top_k_retrieve,
                current_query=retrieval_query,
                filter_stages=parsed_query.relaxed_filters() if parsed_query else [],
            )
            agentic_state = self.agentic_graph.run(agentic_state)
            agentic_info = agentic_state.build_agentic_info()

            if agentic_state.direct_response:
                answer = agentic_state.direct_response
                if session_id:
                    self.memory.add_turn(session_id, user_query, answer)
                run_id = None
                try:
                    rt = get_current_run_tree()
                    if rt:
                        run_id = str(rt.id)
                except Exception:
                    pass
                yield {
                    "type": "metadata",
                    "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace,
                    "session_id": session_id,
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "filter_info": filter_info,
                    "run_id": run_id,
                }
                yield {"type": "token", "content": answer}
                return

            if agentic_state.clarification and not agentic_state.all_relevant:
                fallback = agentic_state.clarification
                if session_id:
                    self.memory.add_turn(session_id, user_query, fallback)
                run_id = None
                try:
                    rt = get_current_run_tree()
                    if rt:
                        run_id = str(rt.id)
                except Exception:
                    pass
                yield {
                    "type": "metadata",
                    "sources": [],
                    "enhanced_query": enhanced_query,
                    "namespace": namespace,
                    "session_id": session_id,
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "filter_info": filter_info,
                    "run_id": run_id,
                }
                yield {"type": "token", "content": fallback}
                return

            if agentic_state.intent == "DECOMPOSE":
                documents = []
                for sq in agentic_state.sub_query_results.values():
                    documents.extend(sq["all_relevant"])
            else:
                documents = agentic_state.all_relevant
        elif enable_smart:
            # SMART PATH: self-correcting retrieval loop
            smart_result = self._smart_retrieve(
                user_query, retrieval_query, pinecone_namespace, top_k_retrieve,
            )
            documents = smart_result["documents"]
            smart_info = smart_result["metrics"]
            clarification = smart_result.get("clarification")

            # Fallback only when zero chunks
            if not documents:
                fallback = clarification or get_smart_fallback_message()
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
                    "smart_info": smart_info,
                    "agentic_info": agentic_info,
                    "filter_info": filter_info,
                    "run_id": _run_id,
                }
                yield {"type": "token", "content": fallback}
                return
        else:
            # STANDARD PATH: filter-first retrieval when filters available
            t_retrieve = time.perf_counter()
            if parsed_query and parsed_query.has_filters:
                documents, filter_used, retrieval_quality = self.retriever.filtered_retrieve(
                    query=retrieval_query,
                    namespace=pinecone_namespace,
                    filter_stages=parsed_query.relaxed_filters(),
                    top_k=top_k_retrieve,
                )
                if filter_info:
                    filter_info["quality"] = retrieval_quality
                    filter_info["filter_used"] = filter_used
                logger.info(
                    "⏱ [stream] filtered_retrieve: %.2fs  (docs=%d, quality=%s)",
                    time.perf_counter() - t_retrieve, len(documents), retrieval_quality,
                )
            else:
                documents = self.retriever.ensemble_retrieve(
                    query=retrieval_query, namespace=pinecone_namespace, top_k=top_k_retrieve,
                )
                logger.info("⏱ [stream] retrieve: %.2fs  (docs=%d)", time.perf_counter() - t_retrieve, len(documents))

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
                "smart_info": smart_info,
                "agentic_info": agentic_info,
                "filter_info": filter_info,
                "run_id": _run_id,
            }
            yield {"type": "token", "content": no_result}
            return

        # ── Capture LangSmith run_id for feedback linkage ────────
        run_id = None
        try:
            rt = get_current_run_tree()
            if rt:
                run_id = str(rt.id)
        except Exception:
            pass

        if enable_agentic and agentic_state is not None and agentic_state.intent == "DECOMPOSE":
            # Emit Metadata
            all_sources = []
            for sq in agentic_state.sub_query_results.values():
                all_sources.extend(_extract_sources(sq["all_relevant"]))
                
            yield {
                "type": "metadata", "sources": all_sources,
                "enhanced_query": enhanced_query,
                "namespace": namespace, "session_id": session_id,
                "smart_info": smart_info,
                "agentic_info": agentic_info,
                "filter_info": filter_info,
                "run_id": run_id,
            }
            
            full_answer_parts = []
            for i, (sq_id, sq_data) in enumerate(agentic_state.sub_query_results.items()):
                sq_query = sq_data["final_query"]
                sq_docs = sq_data["all_relevant"]
                
                if i > 0:
                    sep = "\n\n---\n\n"
                    yield {"type": "token", "content": sep}
                    full_answer_parts.append(sep)
                    
                q_header = f"**{sq_query}**\n\n"
                yield {"type": "token", "content": q_header}
                full_answer_parts.append(q_header)
                
                if not sq_docs:
                    s_msg = "Sorry, insufficient data available to answer this part."
                    yield {"type": "token", "content": s_msg}
                    full_answer_parts.append(s_msg)
                    continue
                    
                local_ans_parts = []
                for token in self.generator.generate_stream(
                    query=sq_query, documents=sq_docs, namespace=pinecone_namespace,
                    chat_history=chat_history, session_id=session_id, enhanced_query=sq_query,
                ):
                    local_ans_parts.append(token)
                    full_answer_parts.append(token)
                    yield {"type": "token", "content": token}
                    
                merged_local_ans = "".join(local_ans_parts)
                is_grnd, score, claims = self.agentic_graph.hallucination_guard.check(merged_local_ans, sq_docs)
                if not is_grnd and score < 0.4:
                    discl = "\n\n⚠️ *Note: Some details may not be directly verified from available documents.*"
                    full_answer_parts.append(discl)
                    yield {"type": "token", "content": discl}
                    
            full_answer = "".join(full_answer_parts)
            agentic_state.answer = full_answer
            agentic_state.sources = all_sources
            # Rebuild info after mutating answer
            agentic_info = agentic_state.build_agentic_info()
            
        else:
            # ── Standard Single-Generation Path ──
            final_docs = documents[:top_k_retrieve]
            sources = _extract_sources(final_docs)
            
            yield {
                "type": "metadata", "sources": sources,
                "enhanced_query": enhanced_query,
                "namespace": namespace, "session_id": session_id,
                "smart_info": smart_info,
                "agentic_info": agentic_info,
                "filter_info": filter_info,
                "run_id": run_id,
            }
                
            full_answer_parts = []
            for token in self.generator.generate_stream(
                query=user_query, documents=final_docs, namespace=pinecone_namespace,
                chat_history=chat_history, session_id=session_id, enhanced_query=enhanced_query,
            ):
                full_answer_parts.append(token)
                yield {"type": "token", "content": token}
                
            full_answer = "".join(full_answer_parts)
            
            if enable_agentic and agentic_state is not None:
                agentic_state.answer = full_answer
                agentic_state.sources = sources
                agentic_state = self.agentic_graph.post_generation_check(agentic_state)
                updated_answer = agentic_state.answer
                agentic_info = agentic_state.build_agentic_info()
                if updated_answer.startswith(full_answer) and len(updated_answer) > len(full_answer):
                    yield {"type": "token", "content": updated_answer[len(full_answer):]}
                full_answer = updated_answer

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
