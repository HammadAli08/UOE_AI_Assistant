"""
Short-Term Conversation Memory Module

Redis Cloud-backed per-session chat history with TTL-based expiry.
"""

import json
import uuid
import time
import logging
from typing import List, Dict, Optional

import redis

from .config import (
    REDIS_HOST,
    REDIS_PORT,
    REDIS_USERNAME,
    REDIS_PASSWORD,
    MEMORY_MAX_TURNS,
    MEMORY_TTL_SECONDS,
)

logger = logging.getLogger(__name__)


class ConversationMemory:
    """Redis Cloud-backed short-term conversation memory."""

    KEY_PREFIX = "uoe:memory:"

    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self.max_turns = MEMORY_MAX_TURNS
        self.ttl = MEMORY_TTL_SECONDS
        self._local_store: Dict[str, Dict] = {}

    def connect(self) -> None:
        """Establish Redis Cloud connection."""
        try:
            self._client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                username=REDIS_USERNAME,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            self._client.ping()
            logger.info("Redis Cloud connected (%s:%s)", REDIS_HOST, REDIS_PORT)
        except (redis.ConnectionError, redis.TimeoutError) as exc:
            logger.warning("Redis Cloud unavailable: %s", exc)
            self._client = None

    def disconnect(self) -> None:
        """Close the Redis connection."""
        if self._client:
            self._client.close()
            logger.info("Redis disconnected")

    @property
    def available(self) -> bool:
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except (redis.ConnectionError, redis.TimeoutError):
            return False

    @staticmethod
    def new_session_id() -> str:
        return uuid.uuid4().hex

    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        if not self.available:
            return self._get_local_history(session_id)
        key = f"{self.KEY_PREFIX}{session_id}"
        try:
            raw = self._client.get(key)
            if raw is None:
                return self._get_local_history(session_id)
            return json.loads(raw)
        except (redis.RedisError, json.JSONDecodeError) as exc:
            logger.warning("Failed to read memory for %s: %s", session_id, exc)
            return self._get_local_history(session_id)

    def add_turn(self, session_id: str, user_message: str, assistant_message: str) -> None:
        if not self.available:
            self._add_local_turn(session_id, user_message, assistant_message)
            return
        key = f"{self.KEY_PREFIX}{session_id}"
        try:
            history = self.get_history(session_id)
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": assistant_message})
            max_messages = self.max_turns * 2
            if len(history) > max_messages:
                history = history[-max_messages:]
            self._client.set(key, json.dumps(history), ex=self.ttl)
        except redis.RedisError as exc:
            logger.warning("Failed to write memory for %s: %s", session_id, exc)
            self._add_local_turn(session_id, user_message, assistant_message)

    def clear(self, session_id: str) -> bool:
        if not self.available:
            return self._clear_local(session_id)
        key = f"{self.KEY_PREFIX}{session_id}"
        try:
            return bool(self._client.delete(key))
        except redis.RedisError as exc:
            logger.warning("Failed to clear memory for %s: %s", session_id, exc)
            return False

    def get_session_info(self, session_id: str) -> Dict:
        if not self.available:
            return self._local_session_info(session_id)
        key = f"{self.KEY_PREFIX}{session_id}"
        try:
            raw = self._client.get(key)
            ttl = self._client.ttl(key)
            if raw is None:
                return self._local_session_info(session_id)
            messages = json.loads(raw)
            return {"exists": True, "turns": len(messages) // 2, "ttl_remaining": max(ttl, 0)}
        except (redis.RedisError, json.JSONDecodeError):
            return self._local_session_info(session_id)

    # ── Local fallback (in-process) when Redis is unavailable ──
    def _prune_local(self) -> None:
        now = time.time()
        expired = [sid for sid, entry in self._local_store.items() if entry["expires_at"] <= now]
        for sid in expired:
            self._local_store.pop(sid, None)

    def _get_local_history(self, session_id: str) -> List[Dict[str, str]]:
        self._prune_local()
        entry = self._local_store.get(session_id)
        if not entry:
            return []
        return entry["messages"]

    def _add_local_turn(self, session_id: str, user_message: str, assistant_message: str) -> None:
        self._prune_local()
        entry = self._local_store.get(session_id, {"messages": [], "expires_at": 0})
        history = entry["messages"]
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": assistant_message})
        max_messages = self.max_turns * 2
        if len(history) > max_messages:
            history = history[-max_messages:]
        self._local_store[session_id] = {
            "messages": history,
            "expires_at": time.time() + self.ttl,
        }

    def _clear_local(self, session_id: str) -> bool:
        return bool(self._local_store.pop(session_id, None))

    def _local_session_info(self, session_id: str) -> Dict:
        self._prune_local()
        if session_id not in self._local_store:
            return {"exists": False, "turns": 0, "ttl_remaining": 0}
        entry = self._local_store[session_id]
        ttl_remaining = max(int(entry["expires_at"] - time.time()), 0)
        return {"exists": True, "turns": len(entry["messages"]) // 2, "ttl_remaining": ttl_remaining}


_memory: Optional[ConversationMemory] = None


def get_memory() -> ConversationMemory:
    global _memory
    if _memory is None:
        _memory = ConversationMemory()
        _memory.connect()
    return _memory
