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
        
    def _requires_transliteration(self, text: str) -> bool:
        """Detects if string contains ANY non-Latin alphabetical characters (e.g. Urdu, Hindi, Punjabi script)."""
        for c in text:
            # If it's a letter and outside basic ASCII/Extended Latin, it's a non-Latin script
            if c.isalpha() and ord(c) > 255:
                return True
        return False

    @traceable(name="voice_transliterator.transliterate", run_type="chain")
    def transliterate(self, text: str) -> str:
        """
        Transliterates any non-Latin script (Urdu/Hindi/Punjabi) into Roman script.
        If no target script is detected, returns the original text.
        """
        if not text.strip():
            return text
            
        if not self._requires_transliteration(text):
            logger.info("🔠 Text is already in Roman/Latin script. Skipping transliteration.")
            return text
            
        logger.info("🔠 Non-Latin script detected. Processing through LLM Transliterator to enforce Roman English/Urdu.")
        
        system_prompt = (
            "Convert the following text into Roman English (Latin script) format.\n"
            "The input could be in Urdu, Hindi, Punjabi, or any other South Asian language script.\n"
            "RULES:\n"
            "1. Preserve the original meaning exactly.\n"
            "2. Do NOT translate to pure English unless the original spoken word was English. Convert to Roman Urdu/Hindi/Punjabi (e.g. 'Acha agar supply aa jaye').\n"
            "3. Do NOT change program names (BSCS, MS Physics), codes, or system keywords.\n"
            "4. The output MUST be entirely in standard Roman English (A-Z, a-z) script.\n"
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
