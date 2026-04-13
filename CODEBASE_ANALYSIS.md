# UOE AI Assistant - Comprehensive Codebase Analysis

**Project Name**: AI-Based Academics and Regulations Assistant (UOE AI Assistant)
**Scope**: Final Year Project Comprehensive Technical Documentation

---

## 1. SYSTEM OVERVIEW

The UOE AI Assistant is a specialized, real-time Retrieval-Augmented Generation (RAG) system designed specifically for the University of Education, Lahore. It empowers students, faculty, and administration to autonomously query university policies, course schemes, fee structures, and general rules. To prevent data crossover and ensure absolute accuracy, the system strictly isolates queries into domain-specific vector namespaces (e.g., BS/ADP programs, MS/PhD programs, Rules & Regulations).

### System Workflow
1. **User Input**: The user sends a natural language query via the React-based frontend, specifying a target domain (namespace) and selecting optional settings like "Agentic RAG" or "Smart RAG".
2. **Query Pre-processing & Routing**: The FastAPI backend receives the request. The query is first enhanced. If Agentic RAG is enabled, the `IntentClassifier` determines if the query can be answered directly (e.g., greetings), requires clarification, needs decomposition into sub-queries, or requires standard retrieval.
3. **Hybrid Retrieval**: The query is embedded using OpenAI's `text-embedding-3-large` (3072 dimensions) and passed to the ensemble retriever which fetches exact semantic matches from the isolated Pinecone database namespace. In-memory LRU caching accelerates frequent queries.
4. **Agentic Self-Correction (Optional)**: If active, a `ChunkGrader` evaluates retrieved chunks. If chunk quality is poor, a `QueryRewriter` generates a new query iteration to try again.
5. **Generation**: The verified documents, chat history, and enhanced query are bundled into a dynamic system prompt. `gpt-4o-mini` streams the answer via Server-Sent Events (SSE). 
6. **Hallucination Checking**: Post-generation, a `HallucinationGuard` cross-checks the LLM's answer against the raw source chunks. If the grounding score falls below `0.4`, a visual disclaimer is appended to the response.
7. **Response & Feedback**: The user views the streamed response and cited sources on the frontend. They can thumbs up/down the response, sending metrics asynchronously to LangSmith for observability.

### Core Features
- Real-time Server-Sent Events (SSE) streaming for low-latency chat interactions.
- Strict Domain/Namespace Isolations to prevent hallucinating a PhD requirement for a BS student.
- Multi-step Agentic RAG logic with an autonomous graph (Direct Answer, Clarify, Decompose, Retrieve).
- Self-correcting query rewrite loop utilizing LLM-as-a-judge for chunk relevance scoring.
- Final-layer Hallucination Guards appending safety disclaimers to ungrounded claims.
- Integrated telemetry and run-tracing via LangSmith middleware.

---

## 2. ARCHITECTURE & COMPONENTS

### Architecture Design
The application utilizes a decoupled, stateless microservice architecture:
- **Frontend (Client Layer)**: A highly interactive Single Page Application (SPA) responsible for state management (Zustand), fluid DOM animations (Framer Motion), and asynchronous SSE streaming.
- **Backend (API / Orchestration Layer)**: A Python FastAPI application implementing a LangGraph-inspired state machine. It acts as the RAG orchestrator, coordinating embedding generation, vector operations, and LLM streaming.
- **Databases (Data / Memory Layer)**:
  - **Pinecone Serverless**: High-performance Vector Database acting as the Long-Term Knowledge layer.
  - **Redis (Optional/Configured)**: Fast key-value store acting as the Short-Term Session Memory layer.
- **External APIs**: OpenAI API (Embeddings & Generation) and LangSmith API (Tracing & Observability).

### Component Breakdown
| Module / File | Responsibility |
|---------------|----------------|
| `frontend/src/` | React SPA containing hooks (`useChat.js`), UI layout, and Tailwind configurations. |
| `backend/main.py` | FastAPI application exposing `/api/chat`, `/api/chat/stream`, and `/api/feedback`. |
| `backend/rag_pipeline/pipeline.py` | Central `RAGPipeline` orchestrator that routes data between memory, retrievers, and generators. |
| `backend/rag_pipeline/agentic_rag/graph.py` | The autonomous decision-making state machine (`AgenticRAGGraph`). Executes the retrieve -> grade -> rewrite loop. |
| `backend/rag_pipeline/agentic_rag/intent_classifier.py` | Classifies query intent: DIRECT, RETRIEVE, DECOMPOSE, CLARIFY. |
| `backend/rag_pipeline/retriever.py` | Manages OpenAI embeddings, local LRU caches, and Pinecone vector queries. |
| `backend/rag_pipeline/generator.py` | Formats context and streams text from OpenAI LLM. |
| `backend/Data_Ingestion/pinecone_ingestion.py` | Offline batch processing script. Analyzes PDFs, performs semantic recursive chunking, extracts robust metadata (course codes, prerequisites), and upserts to Pinecone. |

### Complete Data Flow
`User Interface` → *(JSON Payload)* → `FastAPI Endpoint` → `RAGPipeline Orchestrator` → `IntentClassifier` → `Query Enhancer` → `OpenAI Embedder` → `Pinecone Index (Namespace Match)` → `ChunkGrader` → `OpenAI Generator` → `HallucinationGuard` → *(SSE Stream)* → `React Client`

---

## 3. TECH STACK

**Frontend**
- **React 18**: Chosen for robust component lifecycle and Virtual DOM handling.
- **Vite 6**: Next-generation bundler for near-instant HMR (Hot Module Replacement) and optimized production builds.
- **Tailwind CSS 3.4**: Utility-first CSS framework enabling UI components.
- **Framer Motion**: Enables smooth exit/enter micro-animations to satisfy "premium" UI requirements.
- **Zustand**: Lightweight global state management for chat history and loading flags.

**Backend**
- **Python 3.12+**: Language choice for optimal data science/AI library compatibility.
- **FastAPI**: Asynchronous web framework tailored for high concurrency and native SSE streaming.
- **Pydantic V2**: Native request/response schema validation and type hinting.

**AI / Machine Learning**
- **LangChain Core & Community**: Modular abstractions for prompt templates, text splitters (`RecursiveCharacterTextSplitter`), and document loaders (`PyPDFLoader`).
- **OpenAI `text-embedding-3-large`**: Generates 3072-dimensional dense vectors used for precision semantic matching.
- **OpenAI `gpt-4o-mini`**: Balances high context window limits, speed, and inference cost for both generative answers and chunk grading tasks.
- **Rank-BM25**: Used natively/conceptually in the ensemble setup for sparse keyword/lexical searching to complement dimensional similarity.

**Databases & Infrastructure**
- **Pinecone**: Low-latency Serverless vector database chosen specifically for its native namespace isolation feature (vital to the university's data security model).
- **Redis**: High-speed, in-memory KV store to temporarily hold Chat History objects (`chat_history`), keeping FastAPI completely stateless.
- **LangSmith**: Essential for LLM operations observability, tracking tokens consumed, chain latency, and user feedback inputs.

---

## 4. FUNCTIONAL REQUIREMENTS

* **FR1 - Conversational Chat Querying**: The system MUST accept natural language inputs from the user up to 2000 characters and stream back a generated text response via Server-Sent Events.
  - *Input*: `ChatRequest` (query: str, namespace: str)
  - *Processing*: Retrieves top-K vectors matching the prompt, injects into LLM prompt tree.
  - *Output*: Sequential stream of text tokens.
* **FR2 - Domain Isolation Strategy**: The system MUST restrict knowledge searches strictly to the user-selected namespace (`bs-adp-schemes`, `ms-phd-schemes`, `rules-regulations`, `about-university`).
  - *Input*: Pre-selected dropdown item (Namespace).
  - *Processing*: Backend validates namespace against `NAMESPACE_MAP`, injecting parameter strictly into Pinecone SDK.
  - *Output*: Only documents from the target namespace are utilized.
* **FR3 - Agentic Query Decomposition**: The system MUST decompose complex multi-part queries into standalone sub-queries.
  - *Input*: Complex user string (e.g., "What is the fee for BSCS and the rules for probation?").
  - *Processing*: `QueryDecomposer` splits into two standard search queries which are run in parallel/sequentially against the namespace.
  - *Output*: A unified response generated from combined multi-query documents.
* **FR4 - Self-Correction / Quality Gating**: The system MUST grade similarity search outputs; if relevance confidence is below the established threshold, the system MUST rewrite the query and try again up to `max_retries`.
  - *Input*: Search chunks.
  - *Processing*: `ChunkGrader` scores text against query. `QueryRewriter` generates a new search string.
  - *Output*: Re-execution of Vector Search until `early_success_threshold` is met.
* **FR5 - Feedback Logging Mechanism**: The system MUST provide users the ability to upvote/downvote responses.
  - *Input*: `FeedbackRequest` (run_id: str, score: int).
  - *Processing*: Links the rating to the LangSmith trace ID and appends to local `feedback_log.jsonl`.
  - *Output*: Success header (`200 OK`).

### User Actions Supported
- Sending plain-text messages.
- Toggling "Enhance Query", "Smart Retrieval", and "Agentic Mode".
- Selecting the search domain context.
- Viewing contextual file sources mapped to the answer.
- Upvoting / Downvoting answers.

---

## 5. NON-FUNCTIONAL REQUIREMENTS

- **Performance (Latency / Async)**: Time-to-first-token (TTFT) is minimized utilizing FastAPI's `async def` routing. A local Python dict (`OrderedDict`) caches embedding computations and vector fetches for `RETRIEVAL_CACHE_TTL_SECONDS`.
- **Scalability (Stateless Design)**: The backend API holds zero persistence within its own memory limit besides cache. Chat memory history is piped client-side or serialized in Redis. Scaling horizontal containers is trivial.
- **Security (Validation)**: Pydantic enforces payload bounds: `min_length=1`, `max_length=2000`, `top_k <= 20`. Cross-domain exposure is strictly mitigated entirely via Pinecone API namespace partitions.
- **Reliability (Failure Handling)**: The agentic flow enforces a maximum rewrite loop limit to avoid infinite loops and token starvation. If zero Pinecone results return over all retry limits, the API naturally degrades into providing a fallback clarification message (`NO_RESULTS_MESSAGE`).
- **Maintainability**: Object-oriented graph pattern in `graph.py`. Classes handle distinct nodes (`_node_classify_intent`, `_node_retrieve`). Configurations are entirely segregated into `config.py` and `.env`.
- **Observability**: `@traceable` wrappers inject native spans. Comprehensive metrics (`total_retrievals`, `query_rewrites`, `clarification_asked`) are passed back inside the `agentic_info` block of the API format.

---

## 6. API / BACKEND DETAILS

### Endpoint 1: Standard Chat (Streaming)
**Method + Route**: `POST /api/chat/stream`
**Purpose**: Generates dynamic text to the client UI as it is generated, minimizing perceived load time.
**Input parameters (JSON)**:
```json
{
  "query": "What are the rules for BS probation?",
  "namespace": "rules",
  "enhance_query": true,
  "enable_agentic": true,
  "top_k_retrieve": 5,
  "session_id": "optional-uuid"
}
```
**Output structure (Event Stream format)**:
```text
data: {"type": "metadata", "sources": [{"file": "rules2022.pdf"}], "agentic_info": {"intent": "RETRIEVE"}, "run_id": "abc-123"}

data: {"type": "token", "content": "probation "}
data: {"type": "token", "content": "is "}
data: [DONE]
```

### Endpoint 2: Telemetry Submit
**Method + Route**: `POST /api/feedback`
**Purpose**: Collect human-in-the-loop accuracy ratings based on LLM outputs.
**Input parameters (JSON)**:
```json
{
  "run_id": "abc-123",
  "score": 1,
  "comment": "Accurate details."
}
```
**Output structure (JSON)**: `{"status": "ok"}`

---

## 7. DATABASE / DATA LAYER

As an unstructured data intelligence tool, traditional relational tables (MySQL/PostgreSQL) are not utilized. 

### Entity 1: Document Chunk (Pinecone Vector DB)
* **Storage Engine**: Pinecone AWS us-east-1.
* **Fields**:
  - `id`: Vector UUID `[String]`
  - `values`: Dense numerical embedding array `[Float[3072]]`
  - `metadata`: `[Dictionary]`
* **Metadata Schema (Enforced by Ingestion Scripts)**:
  - `source_file` `[String]`: Source PDF file name.
  - `page_number` `[Integer]`: Page origin.
  - `course_code` `[String]`: Regex-extracted course entity (e.g. COMP1112).
  - `semester` `[Integer]`: Numeric semester tag.
  - `chunk_length` `[Integer]`: Track text length stringency.
  - `namespace` `[String]`: Domain partition key.
* **Purpose**: Acts as the system's "long-term memory" factual foundation.

### Entity 2: Chat History (Redis KV Store)
* **Fields**:
  - `Key`: `session_id` `[String]`
  - `Value`: JSON Array of `{user_query, system_response}` `[String]`
* **Purpose**: Maps user session ID to immediate 10-turn history (TTL: 1800s).

---

## 8. ALGORITHMS / ML LOGIC

### Embedding Logic
PDFs are chunked utilizing `RecursiveCharacterTextSplitter` matching chunk size thresholds specifically tuned to the document semantic traits (e.g. `rules_regulations` max chunk 1000). The text is converted into an accurate numerical topology structure utilizing `text-embedding-3-large`.

### RAG Retrieval Pipeline (Inference Step-by-Step)
1. **Query Enhancer**: Rewrites conversational context ('What prerequisites does it have?') into explicit vectors ('What prerequisites does CS301 have in BSCS degree').
2. **Intent Search Strategy**: 
    - `DIRECT`: Skip Vector DB entirely if query is conversational.
    - `RETRIEVE`: Run standard search.
3. **Retrieval Algorithm**: Execute cosine similarity vector matching over Pinecone, retrieving top-N results. (Abstracted capabilities to merge dense searching and Sparse keyword BM25 retrieval via Reciprocal Rank Fusion / RRF).
4. **Grading Mechanism (Agentic Mode)**: `gpt-4o-mini` is assigned an evaluation instruction matrix to vote on exactly how logically matching a chunk is to the query (`grade_chunks()`). Returns "Relevant" vs "Irrelevant".
5. **Generation**: The surviving "Relevant" chunks are context-stuffed, generating the final context length fed directly as `<context>` to the main LLM.
6. **Hallucination Verification**: `HallucinationGuard` asks the LLM to inspect its *own* generated output and map references to the `source_chunks`, quantifying 0.0 to 1.0 confidence score on fact preservation.

---

## 9. TESTING

### Edge Cases and Constraints Ignored / Handled
- **Zero Document Retrieved**: Emits fallback "Sorry, no relevant documents found in this namespace" instead of guessing randomly. If Agentic routing runs, it attempts via API to guess *why* and issues the user an automated list of clarification inquiries.
- **Payload Starvation**: Max query limit sits at 2000 chars to avoid memory blowing the embedding dimensions and prompt size. High-frequency probes are filtered out by `_access_log_middleware`.
- **Invalid NameSpaces**: Resolves to raise a clean `ValueError` preventing 500 errors and Pinecone access faults.

### Structured Test Cases
| ID | Input / Action | Expected System Output / Condition |
|----|----------------|------------------------------------|
| TC1 | API Query `GET /health` | Returns `{"status": "healthy"}` |
| TC2 | Chat in wrong Namespace (`BS-ADP` query via `Rules` namespace) | Fails to retrieve context. Graceful LLM apology indicating out-of-bounds error. |
| TC3 | Small token conversational input ("Hi") | `IntentClassifier` detects `DIRECT`. Answers without initiating a Pinecone call. |
| TC4 | Complex multi-intent ("What is BS fee and what is MS probation rule?") | Resolves to `DECOMPOSE` branch, spawning isolated internal retrieval events. |
| TC5 | High-intensity fast-clicks on /api/chat/stream | SSE connections managed appropriately. Un-fulfilled promises drop automatically without zombie ports. |
| TC6 | Send `session_id=123` sequentially for two different queries | System contextually pairs prompt #2 with history of prompt #1 utilizing backend Memory logic. |
| TC7 | Ask question entirely unrelated to UOE ("What is thermodynamics?") | Vector space returns low relevance values. `ChunkGrader` drops chunks. System requests clarification. |
| TC8 | Overload prompt up to 2001 chars | Pydantic validation intercept returns HTTP 422 Unprocessable Entity. |
| TC9 | Send up-vote feedback | `run_id` parses, updates local `.jsonl` log, outputs `200 OK`. |
| TC10 | Pinecone Index missing or unreachable | Pinecone client initialization logic defaults to dynamically creating Index upon module load (`create_index` logic), returning 200 upon 10s wait. |

---

## 10. DEPLOYMENT & SETUP

### Environment Configuration (`.env`)
Required Environment Variables:
```env
OPENAI_API_KEY="..."
PINECONE_API_KEY="..."
PINECONE_INDEX_NAME="uoeaiassistant"
LANGSMITH_TRACING_ENABLED="true"
LANGCHAIN_API_KEY="..."
REDIS_HOST="localhost"
```

### Step-by-Step Backend Deployment
1. Navigate to `/backend`.
2. Configure Python 3.12 environment (`python -m venv .venv`).
3. Source environment `source .venv/bin/activate`.
4. Install library dependencies: `pip install -r requirements.txt`.
5. Run Data Pipeline offline (First-time only) mapping isolated domain PDFs into pinecone instances: `python Data_Ingestion/pinecone_ingestion.py`.
6. Start production FastApi web server: `uvicorn main:app --host 0.0.0.0 --port 8000`.

### Frontend Setup
1. Navigate to `/frontend`.
2. Run standard Node resolution `npm install`.
3. Provide `.env` mapping `VITE_API_URL=http://localhost:8000`.
4. Command `npm run build` generates `/dist`. Output can be served via standard NGINX or static web CDN (Vercel, Netlify).

---

## 11. CODE-LEVEL EXPLANATION

### `backend/rag_pipeline/agentic_rag/graph.py`
**Purpose**: Acts as the application's automated brain, executing a flow-control state machine defined by conditional if-else branching mimicking classical graph-based AI frameworks (e.g., LangGraph).
**Interaction**: Loaded inside `pipeline.py`, it accepts the user's initial state object. It traverses nodes `_node_classify_intent()`, evaluating the necessity of moving toward `_node_retrieve()` or `_node_decompose()`. 

**Key Function**: `_retrieval_loop(self, state: AgentState, query: str)`
*Logic*: 
1. Calculates integer boost loop iteration count. 
2. Invokes pinecone to load raw arrays list.
3. Invokes OpenAI miniature model to process grading parameters on the arrays. 
4. Maps high-value semantic documents into an accumulated list (`state.all_relevant`). 
5. Breaks and concludes if loop determines maximum semantic entropy has been reached, avoiding useless redundant searches.

### `backend/rag_pipeline/pipeline.py`
**Purpose**: The central bridge linking API handlers to the AI modules. Provides non-streaming `query()` and streaming `stream_query()`.
**Interaction**: Handles initialization of OpenAI clients, instantiates singletons `get_pipeline()`. Routes responses and manages `time.perf_counter()` to log total milliseconds elapsed during completion. Calculates token emissions and pushes metadata strings out to the frontend immediately before mapping the core generation response logic.
