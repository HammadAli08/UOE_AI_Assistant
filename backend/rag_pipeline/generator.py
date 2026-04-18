"""
Generator Module

Generates final responses using GPT-4o with namespace-specific system prompts.
Supports conversation history (short-term memory) and streaming.
"""

import logging
from typing import List, Dict, Optional, Generator as Gen
from openai import OpenAI

from langsmith import traceable

from .config import (
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    OPENAI_CHAT_TEMPERATURE,
    OPENAI_CHAT_MAX_TOKENS,
    SYSTEM_PROMPTS_DIR,
    SYSTEM_PROMPT_FILES,
)

logger = logging.getLogger(__name__)


class Generator:
    """Generates responses using GPT-4o with appropriate system prompts."""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self._prompt_cache: Dict[str, str] = {}

    def _get_system_prompt(self, namespace: str) -> str:
        if namespace in self._prompt_cache:
            return self._prompt_cache[namespace]
        prompt_file = SYSTEM_PROMPT_FILES.get(namespace)
        if not prompt_file:
            default_prompt = (
                "You are an academic assistant. Answer based on retrieved documents only. "
                "Do NOT add inline source lists or generic labels like 'Document 1'; the UI shows sources."
            )
            self._prompt_cache[namespace] = default_prompt
            return default_prompt
        prompt_path = SYSTEM_PROMPTS_DIR / prompt_file
        if prompt_path.exists():
            prompt = prompt_path.read_text().strip()
            prompt += "\n\nIMPORTANT: If the user communicates in Roman Urdu, you MUST respond in Roman Urdu. NEVER use exact Urdu (Nastaliq/Arabic script) in your response, always use Roman Urdu (Latin script)."
            self._prompt_cache[namespace] = prompt
            return prompt
        default_prompt = (
            "You are an academic assistant. Answer based on retrieved documents only. "
            "Do NOT add inline source lists or generic labels like 'Document 1'; the UI shows sources.\n\n"
            "IMPORTANT: If the user communicates in Roman Urdu, you MUST respond in Roman Urdu. "
            "NEVER use exact Urdu (Nastaliq/Arabic script) in your response, always use Roman Urdu (Latin script)."
        )
        self._prompt_cache[namespace] = default_prompt
        return default_prompt

    def _build_context(self, documents: List[Dict]) -> str:
        if not documents:
            return "No relevant documents found."
        context_parts = []
        for i, doc in enumerate(documents, 1):
            metadata = doc.get("metadata", {})
            source = metadata.get("source_file", "Unknown")
            page = metadata.get("page_number", "N/A")
            text = doc.get("text", "")

            # Build rich metadata header for LLM grounding
            meta_lines = [f"[Document {i}]"]
            meta_lines.append(f"Source: {source}, Page: {page}")

            # Include canonical metadata when available
            # ── BS/ADP fields ──
            program = metadata.get("program_name")
            degree = metadata.get("degree_type")
            chunk_type = metadata.get("chunk_type")
            semester = metadata.get("semester")
            course_code = metadata.get("course_code")
            course_title = metadata.get("course_title")
            department = metadata.get("department")

            # ── Rules & Regulations fields ──
            doc_type = metadata.get("doc_type")
            topic_cluster = metadata.get("topic_cluster")
            reg_scope = metadata.get("regulations_scope")
            eff_year = metadata.get("effective_year")
            authority = metadata.get("authority")

            # ── About University fields ──
            campus_name = metadata.get("campus_name")
            person_name = metadata.get("person_name")
            person_title = metadata.get("person_title")
            facility_type = metadata.get("facility_type")
            shift = metadata.get("shift")
            prog_from_about = metadata.get("program")

            meta_fields = []
            if program:
                meta_fields.append(f"program={program}")
            if degree:
                meta_fields.append(f"degree={degree}")
            if department:
                meta_fields.append(f"department={department}")
            if chunk_type:
                meta_fields.append(f"type={chunk_type}")
            if semester:
                meta_fields.append(f"semester={semester}")
            if course_code:
                meta_fields.append(f"course_code={course_code}")
            if course_title:
                meta_fields.append(f"course_title={course_title}")
            if doc_type:
                meta_fields.append(f"doc_type={doc_type}")
            if topic_cluster:
                meta_fields.append(f"topic={topic_cluster}")
            if reg_scope:
                meta_fields.append(f"applies_to={reg_scope}")
            if eff_year:
                meta_fields.append(f"year={eff_year}")
            if authority:
                meta_fields.append(f"authority={authority}")
            if campus_name:
                meta_fields.append(f"campus={campus_name}")
            if person_name:
                meta_fields.append(f"person={person_name}")
            if person_title:
                meta_fields.append(f"title={person_title}")
            if facility_type:
                meta_fields.append(f"facility={facility_type}")
            if shift:
                meta_fields.append(f"shift={shift}")
            if prog_from_about and not program:
                meta_fields.append(f"program={prog_from_about}")

            if meta_fields:
                meta_lines.append("Metadata: " + " | ".join(meta_fields))

            meta_lines.append(f"Content: {text}")
            context_parts.append("\n".join(meta_lines))
        return "\n\n---\n\n".join(context_parts)

    def _build_messages(
        self,
        query: str,
        documents: List[Dict],
        namespace: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> List[Dict[str, str]]:
        system_prompt = self._get_system_prompt(namespace)
        context = self._build_context(documents)
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if chat_history:
            for msg in chat_history:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": f"Retrieved Documents:\n{context}\n\n---\n\nUser Question: {query}"})
        return messages

    @traceable(name="generator.generate", run_type="llm")
    def generate(
        self,
        query: str,
        documents: List[Dict],
        namespace: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        session_id: str = "",
        enhanced_query: str = "",
    ) -> str:
        """Generate a response using GPT-4o (non-streaming)."""
        messages = self._build_messages(query, documents, namespace, chat_history)
        response = self.client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=messages,
            temperature=OPENAI_CHAT_TEMPERATURE,
            max_completion_tokens=OPENAI_CHAT_MAX_TOKENS,
        )
        return response.choices[0].message.content

    @traceable(name="generator.generate_stream", run_type="llm")
    def generate_stream(
        self,
        query: str,
        documents: List[Dict],
        namespace: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        session_id: str = "",
        enhanced_query: str = "",
    ) -> Gen[str, None, None]:
        """Stream a response token-by-token using GPT-4o."""
        messages = self._build_messages(query, documents, namespace, chat_history)
        emitted = False
        try:
            stream = self.client.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=messages,
                temperature=OPENAI_CHAT_TEMPERATURE,
                max_completion_tokens=OPENAI_CHAT_MAX_TOKENS,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    emitted = True
                    yield delta.content
        except Exception as exc:
            logger.warning("Streaming failed, falling back to non-stream: %s", exc)

        if not emitted:
            try:
                fallback = self.generate(
                    query=query,
                    documents=documents,
                    namespace=namespace,
                    chat_history=chat_history,
                    session_id=session_id,
                    enhanced_query=enhanced_query,
                )
                if fallback:
                    yield fallback
                else:
                    yield "I'm sorry, I couldn't generate a response. Please try again."
            except Exception as exc:
                logger.error("Non-stream fallback failed: %s", exc)
                yield "I'm sorry, an error occurred while generating the response. Please try again."


_generator: Optional[Generator] = None


def get_generator() -> Generator:
    global _generator
    if _generator is None:
        _generator = Generator()
    return _generator
