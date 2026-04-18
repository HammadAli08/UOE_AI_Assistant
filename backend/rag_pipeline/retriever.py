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
from pinecone import Pinecone, ServerlessSpec
from pinecone.exceptions import NotFoundException

from langsmith import traceable

from .config import (
    CACHE_MAX_ENTRIES,
    EMBEDDING_CACHE_TTL_SECONDS,
    PINECONE_API_KEY,
    PINECONE_INDEX_NAME,
    OPENAI_EMBEDDING_DIMENSIONS,
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
        self.index = self._get_or_create_index(PINECONE_INDEX_NAME, OPENAI_EMBEDDING_DIMENSIONS)

        # Initialize OpenAI client once (keep-alive, pooled connections)
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)

        # Small in-memory caches to absorb repeated queries in short windows.
        self._embedding_cache: "OrderedDict[str, Tuple[float, List[float]]]" = OrderedDict()
        self._retrieval_cache: "OrderedDict[Tuple[str, str, int], Tuple[float, List[Dict]]]" = OrderedDict()
        self._cache_lock = Lock()

    @staticmethod
    def _normalize_query(query: str) -> str:
        return " ".join(query.strip().lower().split())

    def _get_or_create_index(self, name: str, dimension: int):
        """
        Ensure the Pinecone index exists. If not found, create a serverless index
        using the same dimension as the embeddings.
        """
        try:
            return self.pc.Index(name)
        except NotFoundException:
            logger.warning("Pinecone index '%s' not found. Creating it (dim=%d)...", name, dimension)
            self.pc.create_index(
                name=name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            return self.pc.Index(name)

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
        top_k: int = DEFAULT_TOP_K_RETRIEVE,
        metadata_filter: Optional[Dict] = None,
    ) -> List[Dict]:
        """
        Retrieve relevant documents from Pinecone.

        Args:
            query: The search query
            namespace: Pinecone namespace to search in
            top_k: Number of results to retrieve
            metadata_filter: Optional Pinecone metadata filter dict.
                             When provided, Pinecone performs filtered
                             vector search (filter FIRST, then rank).

        Returns:
            List of document dictionaries with id, score, text, metadata
        """
        normalized = self._normalize_query(query)
        # Include filter in cache key so filtered vs unfiltered don't collide
        filter_key = str(sorted(metadata_filter.items())) if metadata_filter else ""
        cache_key = (namespace, normalized, int(top_k), filter_key)
        cached_docs = self._cache_get(self._retrieval_cache, cache_key, RETRIEVAL_CACHE_TTL_SECONDS)
        if cached_docs is not None:
            return cached_docs

        # Generate embedding for query
        t_embed = time.perf_counter()
        query_embedding = self._embed_query(query)
        embed_seconds = time.perf_counter() - t_embed

        # Build Pinecone query kwargs
        query_kwargs: Dict[str, Any] = {
            "vector": query_embedding,
            "namespace": namespace,
            "top_k": top_k,
            "include_metadata": True,
        }
        if metadata_filter:
            query_kwargs["filter"] = metadata_filter
            logger.info(
                "🔎 Filtered retrieve: namespace=%s filter=%s top_k=%d",
                namespace, metadata_filter, top_k,
            )

        # Search in specific namespace only (strict isolation)
        t_query = time.perf_counter()
        results = self.index.query(**query_kwargs)
        query_seconds = time.perf_counter() - t_query

        # Convert to document format
        documents = []
        for match in results.matches:
            metadata = match.metadata or {}

            # Extract text content - use full text field (text_preview is only 400 chars)
            text = metadata.get("text", "")
            if not text:
                text = metadata.get("text_preview", "")

            doc = {
                "id": match.id,
                "score": float(match.score),
                "text": text,
                "metadata": metadata
            }
            documents.append(doc)

        self._cache_set(self._retrieval_cache, cache_key, documents)
        logger.debug(
            "Retriever timings: embed=%.2fs pinecone=%.2fs top_k=%d namespace=%s filter=%s",
            embed_seconds,
            query_seconds,
            top_k,
            namespace,
            bool(metadata_filter),
        )
        return documents

    # ── Ensemble retrieval (Dense + BM25 via Reciprocal Rank Fusion) ──

    @traceable(name="retriever.ensemble_retrieve", run_type="retriever")
    def ensemble_retrieve(
        self,
        query: str,
        namespace: str,
        top_k: int = DEFAULT_TOP_K_RETRIEVE,
        metadata_filter: Optional[Dict] = None,
    ) -> List[Dict]:
        """Dense-only ensemble stub: return top_k dense results (no RRF/BM25)."""
        return self.retrieve(query, namespace, top_k, metadata_filter=metadata_filter)

    # ── Filter-first retrieval with progressive relaxation ──

    @traceable(name="retriever.filtered_retrieve", run_type="retriever")
    def filtered_retrieve(
        self,
        query: str,
        namespace: str,
        filter_stages: List[Dict],
        top_k: int = DEFAULT_TOP_K_RETRIEVE,
    ) -> Tuple[List[Dict], Dict, str]:
        """
        Filter-first retrieval with progressive relaxation.

        Tries each filter stage in order. If a stage returns results,
        returns them immediately. If not, relaxes to the next stage.

        Args:
            query: Search query (already enhanced)
            namespace: Pinecone namespace
            filter_stages: List of progressively relaxed filter dicts
                          (from ParsedQuery.relaxed_filters())
            top_k: Number of results per stage

        Returns:
            Tuple of (documents, filter_used, retrieval_quality)
            retrieval_quality is one of:
                'FILTERED'  — results matched the primary filter
                'RELAXED'   — results required filter relaxation
                'SEMANTIC'  — no filter worked, pure semantic fallback
        """
        for i, stage_filter in enumerate(filter_stages):
            is_last = (i == len(filter_stages) - 1)
            is_empty = not stage_filter

            documents = self.ensemble_retrieve(
                query=query,
                namespace=namespace,
                top_k=top_k,
                metadata_filter=stage_filter if stage_filter else None,
            )

            if documents:
                if i == 0:
                    quality = "FILTERED"
                elif is_empty:
                    quality = "SEMANTIC"
                else:
                    quality = "RELAXED"

                logger.info(
                    "✅ filtered_retrieve: stage=%d/%d quality=%s docs=%d filter=%s",
                    i + 1, len(filter_stages), quality, len(documents),
                    stage_filter or "(none)",
                )
                return documents, stage_filter, quality

            logger.info(
                "⚠️ filtered_retrieve: stage=%d/%d returned 0 docs, relaxing. filter=%s",
                i + 1, len(filter_stages), stage_filter or "(none)",
            )

        # Should not reach here (last stage is always empty = pure semantic)
        logger.warning("filtered_retrieve: all stages exhausted, returning empty")
        return [], {}, "SEMANTIC"


# Singleton instance
_retriever: Optional[Retriever] = None


def get_retriever() -> Retriever:
    """Get or create Retriever singleton."""
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever
