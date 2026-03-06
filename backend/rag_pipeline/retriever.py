"""
Retriever Module

Handles vector search against Pinecone with namespace isolation.
"""

import copy
import logging
import time
from collections import OrderedDict
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

from openai import OpenAI
from pinecone import Pinecone

from langsmith import traceable

from .config import (
    CACHE_MAX_ENTRIES,
    EMBEDDING_CACHE_TTL_SECONDS,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    OPENAI_API_KEY,
    OPENAI_EMBEDDING_MODEL,
    OPENAI_EMBEDDING_DIMENSIONS,
    RETRIEVAL_CACHE_TTL_SECONDS,
    DEFAULT_TOP_K_RETRIEVE,
    ENSEMBLE_ENABLED,
    ENSEMBLE_DENSE_WEIGHT,
    ENSEMBLE_SPARSE_WEIGHT,
    ENSEMBLE_OVERFETCH_MULTIPLIER,
    ENSEMBLE_MAX_CANDIDATES,
    RRF_K,
)

logger = logging.getLogger(__name__)


class Retriever:
    """
    Retrieves relevant documents from Pinecone vector store.
    Enforces namespace isolation.
    """

    def __init__(self):
        # Initialize Pinecone
        self.pc = Pinecone(api_key=PINECONE_API_KEY)
        self.index = self.pc.Index(PINECONE_INDEX_NAME)

        # Initialize OpenAI client once (keep-alive, pooled connections)
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)

        # Small in-memory caches to absorb repeated queries in short windows.
        self._embedding_cache: "OrderedDict[str, Tuple[float, List[float]]]" = OrderedDict()
        self._retrieval_cache: "OrderedDict[Tuple[str, str, int], Tuple[float, List[Dict]]]" = OrderedDict()
        self._cache_lock = Lock()

    @staticmethod
    def _normalize_query(query: str) -> str:
        return " ".join(query.strip().lower().split())

    def _cache_get(self, cache: OrderedDict, key: Any, ttl_seconds: float):
        now = time.time()
        with self._cache_lock:
            payload = cache.get(key)
            if payload is None:
                return None
            ts, value = payload
            if now - ts > ttl_seconds:
                cache.pop(key, None)
                return None
            cache.move_to_end(key)
            return copy.deepcopy(value)

    def _cache_set(self, cache: OrderedDict, key: Any, value: Any) -> None:
        with self._cache_lock:
            cache[key] = (time.time(), copy.deepcopy(value))
            cache.move_to_end(key)
            while len(cache) > CACHE_MAX_ENTRIES:
                cache.popitem(last=False)

    @traceable(name="retriever.embed_query", run_type="embedding")
    def _embed_query(self, query: str) -> List[float]:
        normalized = self._normalize_query(query)
        cached = self._cache_get(self._embedding_cache, normalized, EMBEDDING_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        request_kwargs: Dict[str, Any] = {
            "model": OPENAI_EMBEDDING_MODEL,
            "input": query,
        }
        if OPENAI_EMBEDDING_DIMENSIONS > 0:
            request_kwargs["dimensions"] = OPENAI_EMBEDDING_DIMENSIONS

        response = self.openai_client.embeddings.create(**request_kwargs)
        embedding = response.data[0].embedding
        self._cache_set(self._embedding_cache, normalized, embedding)
        return embedding

    @traceable(name="retriever.retrieve", run_type="retriever")
    def retrieve(
        self,
        query: str,
        namespace: str,
        top_k: int = DEFAULT_TOP_K_RETRIEVE
    ) -> List[Dict]:
        """
        Retrieve relevant documents from Pinecone.
        
        Args:
            query: The search query
            namespace: Pinecone namespace to search in
            top_k: Number of results to retrieve
            
        Returns:
            List of document dictionaries with id, score, text, metadata
        """
        normalized = self._normalize_query(query)
        cache_key = (namespace, normalized, int(top_k))
        cached_docs = self._cache_get(self._retrieval_cache, cache_key, RETRIEVAL_CACHE_TTL_SECONDS)
        if cached_docs is not None:
            return cached_docs

        # Generate embedding for query
        t_embed = time.perf_counter()
        query_embedding = self._embed_query(query)
        embed_seconds = time.perf_counter() - t_embed

        # Search in specific namespace only (strict isolation)
        t_query = time.perf_counter()
        results = self.index.query(
            vector=query_embedding,
            namespace=namespace,
            top_k=top_k,
            include_metadata=True
        )
        query_seconds = time.perf_counter() - t_query

        # Convert to document format
        documents = []
        for match in results.matches:
            metadata = match.metadata or {}

            # Extract text content (try multiple fields)
            text = metadata.get("text_preview", "")
            if not text:
                text = metadata.get("page_content", "")

            doc = {
                "id": match.id,
                "score": float(match.score),
                "text": text,
                "metadata": metadata
            }
            documents.append(doc)

        self._cache_set(self._retrieval_cache, cache_key, documents)
        logger.debug(
            "Retriever timings: embed=%.2fs pinecone=%.2fs top_k=%d namespace=%s",
            embed_seconds,
            query_seconds,
            top_k,
            namespace,
        )
        return documents

    # ── Ensemble retrieval (Dense + BM25 via Reciprocal Rank Fusion) ──

    @traceable(name="retriever.ensemble_retrieve", run_type="retriever")
    def ensemble_retrieve(
        self,
        query: str,
        namespace: str,
        top_k: int = DEFAULT_TOP_K_RETRIEVE,
    ) -> List[Dict]:
        """
        Ensemble retriever: over-fetches from Pinecone (dense), applies a
        local BM25 keyword score on the returned texts, and fuses both
        ranked lists using Reciprocal Rank Fusion (RRF).

        Falls back to dense-only if ensemble is disabled or BM25 fails.

        Args:
            query:     The search query
            namespace: Pinecone namespace to search in
            top_k:     Number of final results to return

        Returns:
            List of document dicts sorted by fused RRF score
        """
        if not ENSEMBLE_ENABLED:
            return self.retrieve(query, namespace, top_k)

        # 1. Over-fetch from Pinecone (dense retrieval)
        overfetch_k = min(
            top_k * ENSEMBLE_OVERFETCH_MULTIPLIER,
            ENSEMBLE_MAX_CANDIDATES,
        )
        overfetch_k = max(overfetch_k, top_k)  # never less than top_k

        candidates = self.retrieve(query, namespace, overfetch_k)
        if not candidates:
            return []

        # 2. Build ephemeral BM25 index over candidate texts
        try:
            from rank_bm25 import BM25Okapi

            texts = [doc.get("text", "") or "" for doc in candidates]
            # Simple whitespace tokenisation (fast, language-agnostic)
            tokenized_corpus = [t.lower().split() for t in texts]
            tokenized_query = query.lower().split()

            # Guard: if every document text is empty, skip BM25
            if all(len(t) == 0 for t in tokenized_corpus):
                logger.debug("Ensemble: all candidate texts empty, falling back to dense-only")
                return candidates[:top_k]

            bm25 = BM25Okapi(tokenized_corpus)
            bm25_scores = bm25.get_scores(tokenized_query)  # numpy array, len == len(candidates)

        except Exception as exc:
            logger.warning("Ensemble BM25 scoring failed (%s), falling back to dense-only", exc)
            return candidates[:top_k]

        # 3. Build rank maps for both signals
        #    Dense rank: candidates are already sorted by Pinecone score (desc)
        dense_rank = {doc["id"]: rank for rank, doc in enumerate(candidates)}

        #    BM25 rank: sort candidate indices by BM25 score (desc)
        bm25_order = sorted(range(len(candidates)), key=lambda i: -bm25_scores[i])
        bm25_rank = {candidates[idx]["id"]: rank for rank, idx in enumerate(bm25_order)}

        # 4. Reciprocal Rank Fusion
        k = RRF_K
        wd = ENSEMBLE_DENSE_WEIGHT
        ws = ENSEMBLE_SPARSE_WEIGHT

        fused: List[Tuple[Dict, float]] = []
        for doc in candidates:
            doc_id = doc["id"]
            rrf_score = (
                wd * (1.0 / (k + dense_rank.get(doc_id, len(candidates))))
                + ws * (1.0 / (k + bm25_rank.get(doc_id, len(candidates))))
            )
            fused.append((doc, rrf_score))

        # Sort by fused score descending
        fused.sort(key=lambda x: -x[1])

        # Attach ensemble metadata and return top_k
        results: List[Dict] = []
        for doc, rrf_score in fused[:top_k]:
            doc["ensemble_score"] = round(rrf_score, 6)
            doc["dense_rank"] = dense_rank.get(doc["id"], -1)
            doc["bm25_rank"] = bm25_rank.get(doc["id"], -1)
            results.append(doc)

        logger.info(
            "Ensemble retrieve: %d candidates → top %d via RRF "
            "(dense_w=%.2f, bm25_w=%.2f, rrf_k=%d, namespace=%s)",
            len(candidates), len(results), wd, ws, k, namespace,
        )
        return results


# Singleton instance
_retriever: Optional[Retriever] = None


def get_retriever() -> Retriever:
    """Get or create Retriever singleton."""
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
