import re
import json
import logging
import time
import numpy as np
from typing import Dict, Any

from openai import OpenAI
from pydantic import BaseModel, Field

from ..config import OPENAI_API_KEY
from ..retriever import get_retriever
from langsmith import traceable

logger = logging.getLogger(__name__)

# Regional filler words (hardcoded as per spec)
REGIONAL_FILLERS = [
    'um', 'uh', 'like', 'you know', 'acha', 'matlab', 'yani', 'to', 'hmm', 'han', 'hanji', 'theek hai'
]

class NormalizationResult(BaseModel):
    normalized_query: str = Field(description="The cleaned structurally sound query.")
    confidence: float = Field(description="Confidence score in the normalization between 0.0 and 1.0.")
    changed: bool = Field(description="True if the text was actually modified.")

class VoiceNormalizer:
    def __init__(self):
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        # Using gpt-4o-mini for normalization (cheap, fast, structured)
        self.normalization_model = "gpt-4o-mini"
    
    @staticmethod
    def _cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))
    
    def _heuristic_score(self, query: str) -> int:
        """
        Calculates the heuristic score for gating normalization.
        IF score >= 2 -> TRIGGER NORMALIZATION
        """
        score = 0
        q_lower = query.lower()
        words = q_lower.replace(",", "").replace(".", "").replace("?", "").split()
        
        if not words:
            return 0
            
        # 1. starts_with_filler
        if words[0] in REGIONAL_FILLERS:
            score += 1
            
        # 2. filler_density > 0.05
        filler_count = sum(1 for w in words if w in REGIONAL_FILLERS)
        if (filler_count / len(words)) > 0.05:
            score += 1
            
        # 3. avg_sentence_length > threshold
        sentences = re.split(r'[.!?]+', query)
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences:
            # If no sentences (e.g. no punctuation), it's highly unstructured
            avg_length = len(words)
        else:
            avg_length = len(words) / len(sentences)
        
        if avg_length > 15: # Arbitrary threshold for rambling voice query
            score += 1
            
        # 4. no punctuation
        if not any(char in query for char in ['.', '?', '!']):
            score += 1
            
        return score

    @traceable(name="voice_normalizer.normalize_query", run_type="chain")
    def normalize_query(self, raw_transcript: str) -> str:
        """
        Normalizes a raw Voice-to-Text transcript to be semantic-filter friendly.
        1. Heuristic Gating.
        2. LLM Cleanup if score >= 2.
        3. Semantic drift check (cosine_similarity >= 0.85).
        Returns the safe query (either normalized or raw fallback).
        """
        if not raw_transcript.strip():
            return raw_transcript

        # --- 1. Heuristic Gating ---
        score = self._heuristic_score(raw_transcript)
        logger.info(f"🎤 Voice Heuristic Score: {score}/4 for query: '{raw_transcript[:50]}...'")
        
        if score < 2:
            logger.info("🎤 Passing raw transcript through (Score < 2).")
            return raw_transcript.strip()
            
        # --- 2. LLM Cleanup ---
        logger.info("🎤 Processing through LLM Normalizer due to high heuristic score.")
        
        system_prompt = (
            "You are a strict Voice-to-Text normalizer for an Academic RAG system. "
            "You will be given a raw spoken transcript. Your task is to clean it up.\n\n"
            "RULES:\n"
            "1. DO NOT alter domain keywords, program names, or department codes. Preserve exact terminologies.\n"
            "2. Fix syntax and remove filler words (um, ah, like, acha, matlab, etc.).\n"
            "3. If the user asks multiple distinct questions, DO NOT blend them into one. Keep all intents distinct for downstream decomposition.\n"
            "4. Return ONLY valid JSON in the requested format."
        )
        
        try:
            t_start = time.perf_counter()
            response = self.openai_client.beta.chat.completions.parse(
                model=self.normalization_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Raw Transcript:\n{raw_transcript}"}
                ],
                response_format=NormalizationResult,
                temperature=0.0
            )
            parsed: NormalizationResult = response.choices[0].message.parsed
            t_end = time.perf_counter()
            
            logger.info(f"🎤 Normalization took {t_end - t_start:.2f}s. Result: {parsed.changed}, Confidence: {parsed.confidence}")
            
            if not parsed.changed:
                return raw_transcript.strip()
                
            normalized_query = parsed.normalized_query.strip()
            
            # --- 3. Semantic Drift Safety Bounds ---
            if parsed.confidence < 0.6:
                logger.warning(f"🎤 Low confidence normalization ({parsed.confidence}). Falling back to raw transcript.")
                return raw_transcript.strip()
                
            retriever = get_retriever()
            emb_raw = retriever._embed_query(raw_transcript)
            emb_norm = retriever._embed_query(normalized_query)
            
            similarity = self._cosine_similarity(emb_raw, emb_norm)
            logger.info(f"🎤 Semantic Similarity: {similarity:.4f}")
            
            if similarity < 0.85:
                logger.warning(f"🎤 Severe semantic drift detected (< 0.85). Falling back to raw transcript.")
                return self._enforce_token_budget(raw_transcript.strip())
                
            return self._enforce_token_budget(normalized_query)

        except Exception as e:
            logger.error(f"🎤 Normalization failed: {str(e)}. Falling back to raw transcript.")
            return self._enforce_token_budget(raw_transcript.strip())
            
    def _enforce_token_budget(self, query: str) -> str:
        """Truncate mathematically to prevent RAG overflow. Limit ~150 words (equivalent to 15s of fast speech)."""
        words = query.split()
        if len(words) > 150:
            logger.warning(f"🎤 Token budget exceeded ({len(words)} words). Truncating.")
            return " ".join(words[:150]) + "..."
        return query
