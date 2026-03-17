"""
RAG Pipeline Package

Production-grade RAG pipeline for UOE Lahore Academic AI Assistant.

Components:
- QueryEnhancer: Optimizes queries for vector search
- Retriever: Fetches documents from Pinecone with ensemble retrieval
  (Dense semantic + BM25 sparse scoring fused via Reciprocal Rank Fusion)
- Generator: Produces final answers using GPT-4o-mini
- ConversationMemory: Redis-backed short-term session memory
- AgenticRAGGraph: Autonomous decision-making retrieval with intent routing,
  query decomposition, self-correcting retrieval, and hallucination guard
- RAGPipeline: Orchestrates the full pipeline
"""

from .config import VALID_NAMESPACES, NAMESPACE_MAP
from .query_enhancer import QueryEnhancer, get_query_enhancer
from .retriever import Retriever, get_retriever
from .generator import Generator, get_generator
from .memory import ConversationMemory, get_memory
from .agentic_rag import (
    AgenticRAGGraph,
    get_agentic_graph,
    AGENTIC_RAG_CONFIG,
)
from .pipeline import RAGPipeline, get_pipeline

__all__ = [
    # Configuration
    "VALID_NAMESPACES",
    "NAMESPACE_MAP",

    # Classes
    "QueryEnhancer",
    "Retriever",
    "Generator",
    "ConversationMemory",
    "AgenticRAGGraph",
    "RAGPipeline",

    # Factory functions
    "get_query_enhancer",
    "get_retriever",
    "get_generator",
    "get_memory",
    "get_agentic_graph",
    "get_pipeline",

    # Config
    "AGENTIC_RAG_CONFIG",
]
