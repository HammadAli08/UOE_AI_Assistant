import logging
import time
from typing import Optional
from openai import OpenAI
from ..config import OPENAI_API_KEY
from langsmith import traceable

logger = logging.getLogger(__name__)

class VoiceTransliterator:
    """
    Post-processing transliteration layer for Voice-to-Text.
    Converts Nastaliq (Arabic script) Urdu into Roman Urdu (Latin script),
    preserving keywords and meaning exactly.
    """
    
    def __init__(self):
        self.openai_client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = "gpt-4o-mini"
        
    def _is_urdu(self, text: str) -> bool:
        """Detects if string contains Arabic/Nastaliq script characters."""
        return any('\u0600' <= c <= '\u06FF' for c in text)

    @traceable(name="voice_transliterator.transliterate", run_type="chain")
    def transliterate(self, text: str) -> str:
        """
        Transliterates Urdu script into Roman Urdu.
        If no Urdu script is detected, returns the original text.
        """
        if not text.strip():
            return text
            
        if not self._is_urdu(text):
            logger.info("🔠 No Urdu script detected. Skipping transliteration.")
            return text
            
        logger.info("🔠 Urdu script detected. Processing through LLM Transliterator.")
        
        system_prompt = (
            "Convert the following Urdu text into Roman Urdu (Latin script).\n"
            "RULES:\n"
            "1. Preserve meaning exactly.\n"
            "2. Do NOT translate to English. ONLY convert the script to Roman Urdu.\n"
            "3. Do NOT change program names (BSCS, MS Physics), codes, or English words.\n"
            "4. Only convert Urdu script into Roman Urdu.\n"
            "5. Return nothing but the transliterated text."
        )
        
        try:
            t_start = time.perf_counter()
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                temperature=0.0
            )
            transliterated = response.choices[0].message.content.strip()
            t_end = time.perf_counter()
            
            logger.info(f"🔠 Transliteration took {t_end - t_start:.2f}s. Result: '{transliterated[:50]}...'")
            return transliterated
            
        except Exception as e:
            logger.error(f"🔠 Transliteration failed: {str(e)}. Falling back to original Urdu.")
            return text
