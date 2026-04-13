# Non-Functional Requirements Specification
**Project:** UOE AI Assistant
**Role:** Software Quality Analyst
**Scope:** Full-Stack Architecture, Data Layer, RAG Pipeline

This document defines the Non-Functional Requirements (NFRs) of the UOE AI Assistant. Every requirement is derived explicitly from physical implementation details within the given codebase—avoiding arbitrary or generic assumptions.

---

## 1. PERFORMANCE

### NFR1: Asynchronous Request Processing
* **Description**: The system must process concurrent incoming chat connections asynchronously to maintain high throughput and optimal server resource utilization during high traffic loads.
* **Implementation Evidence**: Utilizes Python's `FastAPI` framework with HTTP endpoints explicitly declared as `async def` (e.g., `async def chat_stream(request: ChatRequest)` in `main.py`). This prevents thread-blocking during slow IO-bound calls (like hitting OpenAI or Pinecone APIs).

### NFR2: Real-time Payload Streaming
* **Description**: The generation pipeline must progressively return output to the client rather than waiting for the entire LLM response to complete, minimizing the time to first byte (TTFB).
* **Implementation Evidence**: Implemented via Server-Sent Events (SSE) utilizing FastAPI's `StreamingResponse` wrapping an asynchronous generator (`run_agent_stream`). The frontend uses the standard `fetch` API processing stream readers (`reader.read()`) to chunk state incrementally to the UI.

### NFR3: Accelerated Retrieval via Memory Caching
* **Description**: The backend must utilize an in-memory datastore cache to persist recent conversation contexts rather than continually computing past conversational vectors or hitting disk storage.
* **Implementation Evidence**: Defined in `memory.py`, the system initiates a connection to Redis (`redis.Redis(host=os.getenv("REDIS_HOST"))`). Context tracking arrays are fetched directly from RAM memory mappings rather than a slower relational datastore.

---

## 2. SCALABILITY

### NFR4: Stateless Microservice Backend
* **Description**: The backend chat API must operate in a strictly stateless manner locally, allowing the application to be scaled horizontally across multiple instances without state synchronization conflicts.
* **Implementation Evidence**: Persistent chat records are exclusively stored on the frontend via Supabase API calls. Mid-chat session histories are offloaded from local Python dictionary graphs directly into external centralized Redis. The FastAPI application instance runs fully stateless. 

### NFR5: Offloaded Resource-Intensive Services
* **Description**: Compute-heavy calculations and persistent indexing must be decoupled from the core application layer to allow isolated scale thresholds.
* **Implementation Evidence**:
  - Raw ML vector representations natively decoupled out of local disk and pushed into a managed serverless architecture via Pinecone.
  - Relational database scaling managed securely out via Supabase JavaScript connectors avoiding local hardware constraints.

---

## 3. SECURITY

### NFR6: Database Tenant Isolation (RLS)
* **Description**: Database query mechanisms must strictly enforce data isolation natively on the server level protecting unauthorized multi-tenant queries mapping globally.
* **Implementation Evidence**: `supabase_schema.sql` establishes Row Level Security (RLS) policies defining `USING (auth.uid() = user_id)`. Any HTTP REST call via the frontend explicitly mandates a validated JWT token payload bridging identical user constraints.

### NFR7: Environment Context Protection
* **Description**: Production credentials required for orchestration systems and LLM providers must be forcefully masked, blocking client interception or frontend leakage.
* **Implementation Evidence**: Uses `python-dotenv` and centralized variables via `.env`. Configurations are ingested via `os.getenv()` in Python strictly residing entirely on the isolated server runtime. No API Keys to LLMs or Pinecone instances are routed to `frontend/package.json` logic.

### NFR8: Client Route Guards
* **Description**: The interface UI must forcibly block unauthenticated users from bypassing access controls towards functional layouts. 
* **Implementation Evidence**: Auth routing wraps layout files forcing logical lifecycle hooks confirming token presence. If generic user visits a secure endpoint without JWT configurations, auto-redirection triggers routing the client backwards cleanly.

---

## 4. RELIABILITY

### NFR9: Graceful Exception Handling
* **Description**: The system must intelligently handle runtime failures via fallbacks providing logical feedback and gracefully terminating routines rather than generating core system crashes.
* **Implementation Evidence**: 
  - Implementation relies on logical `try/except` mapping across API endpoints (`main.py`).
  - Internal application logic parses `asyncio.CancelledError` via SSE Abort signals closing server iterations dynamically.
  - Generates parsed HTTP `500 Internal Server Error` strings containing error types vs allowing standard raw stack traces to explode onto production interfaces.

### NFR10: Hallucination Verification Barriers
* **Description**: RAG outputs must defensively fail post-generation routines safely blocking incorrect or dangerously untamed conversational iterations.
* **Implementation Evidence**: Bound in `agentic_rag/graph.py` inside the `post_generation_check` node. Graph validation algorithms define boundaries (e.g., returning mapped `"hallucinated"` tags routing iterative rewrites) if grounded output checks fail structurally preventing unverified payloads delivering backwards visually to users.

---

## 5. MAINTAINABILITY

### NFR11: Separation of Concerns (SoC)
* **Description**: Directory implementations must map to explicit separated logic domains enabling isolated code evolution with minimal conflict risks.
* **Implementation Evidence**: 
  - React Interface runs its own `Node` ecosystem physically decoupled utilizing isolated package managers (`package.json`).
  - Data ingestion features (`pinecone_ingestion.py`) run statically untethered connecting offline parsing layers outside the standard high-throughput RAG backend REST loops.

### NFR12: Centralized Dependency & Configurations
* **Description**: Core system toggles and deployment constraints must map to tightly controlled localized definitions dictating overarching logical flows.
* **Implementation Evidence**: 
  - Backend uses `requirements.txt` locking core dependency branches.
  - Parameters like overlap limits, prompt instructions, and caching TTLs map via configuration classes explicitly imported into logic rather than floating unmaintainable Magic Numbers recursively throughout algorithms.

---

## 6. OBSERVABILITY

### NFR13: Intelligent Metric Tracing
* **Description**: The logical behavior of backend generative chains must be externally trackable rendering iterative optimization diagnostics accessible to development teams.
* **Implementation Evidence**: Enabled telemetry wrapping logic (`from langsmith import traceable`). Hooks are implemented directly allowing RAG operations capturing multi-tier ML steps (chunk generation lengths, embedding counts, chain latencies).

### NFR14: Real-time Application Logic Logging
* **Description**: Standard operating logic mapping I/O payloads must emit formal time-stamped structures across application instances.
* **Implementation Evidence**: Built-in Python `logging` instances track API endpoints declaring operational INFO and ERROR state blocks providing direct shell observability against Uvicorn startup behaviors.

---

## 7. INPUT VALIDATION

### NFR15: Strict API Schema Enforcement
* **Description**: Data hitting internal logic endpoints structurally validates itself dropping payload processing early saving backend resources safely.
* **Implementation Evidence**: FastAPI dynamically bounds inputs enforcing strict typing validations mapping specifically defined endpoints inheriting from `Pydantic` `BaseModel`. For example: the `ChatRequest` requires distinct typing enforcing `message`, `session_id`, `namespace`, rejecting all improperly structured inbound REST attacks automatically.
