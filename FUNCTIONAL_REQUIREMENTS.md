# Functional Requirements Specification
**Project:** UOE AI Assistant
**Engineer:** Software Requirements Engineer
**Scope:** Frontend, Backend API, Database Pipelines, RAG/ML Workflows

Based on a deep-dive analysis of the codebase, the following formal Functional Requirements (FRs) comprehensively describe the system's explicit behaviors.

---

### **User Identity & Sessions**

**FR1: User Authentication via External Provider**
- **Description**: Authenticates users into the system via external APIs.
- **Input**: User credentials (email/password) provided in the frontend UI (`Auth.jsx`).
- **Processing**: Forwards credentials via the Supabase client wrapper (`supabase.js`). Validates the returned JWT authentication token and binds it to the global Zustand state (`useAuthStore.js`).
- **Output**: Grants the user access to the private application routes and UI components.

**FR2: Local Chat Session Persistence**
- **Description**: Saves and restores frontend chat history natively.
- **Input**: Creating a new chat thread or navigating via the UI.
- **Processing**: The `chatPersistence.js` utility evaluates the current message list arrays. It serializes and synchronizes the messages arrays into browser local storage (or Supabase syncing), categorizing the data by `session_id`.
- **Output**: Automatically populates existing conversations upon page reloads and maintains active thread separation.

---

### **System Parameters & Request Flow**

**FR3: Configurable Namespace Selection**
- **Description**: Limits search boundaries dynamically.
- **Input**: The user selects a specific domain (BS/ADP, MS/PhD, Rules, About) from a dropdown menu in the UI.
- **Processing**: The selection triggers a fetch to the backend `GET /api/namespaces` to verify valid IDs. The string is then passed downstream as the `namespace` variable in the standard payload.
- **Output**: Constrains vector database searches strictly to the specified category, preventing cross-domain output contamination.

**FR4: Input Validation and Routing Constraints**
- **Description**: Verifies structure before executing expensive compute resources.
- **Input**: Text submission payload targeting the `POST /api/chat` or `POST /api/chat/stream` endpoints.
- **Processing**: The `ChatRequest` Pydantic models automatically validate boundaries (string length `min_length=1`, `max_length=2000`, numeric values `top_k_retrieve`).
- **Output**: Forwards valid schemas to the internal `Pipeline` classes or instantly rejects the payload returning a formatted `400 Bad Request`.

**FR5: Client-Side Output Cancellation**
- **Description**: Halts the streaming response intentionally.
- **Input**: The user clicking a "Stop generating" UI element in the `Input` frontend component.
- **Processing**: Triggers a standard JavaScript `AbortController` signal to the active fetch parameter (`useChat.js`). 
- **Output**: Immediately terminates the front-end stream reader hook, saving local UI cycles and ceasing text rendering.

---

### **Agentic RAG State Machine**

**FR6: Autonomous Intent Classification**
- **Description**: Determines if an inference pipeline requires document retrieval or an immediate conversational response.
- **Input**: User query text and active boolean flag `enable_agentic=True`.
- **Processing**: The `IntentClassifier` node passes the raw query to an LLM evaluator, tagging it into distinct behaviors (DIRECT, CLARIFY, DECOMPOSE, RETRIEVE). 
- **Output**: Hard-routes the execution tree avoiding expensive database queries for simple greetings and meta questions.

**FR7: Query Clarification Generation**
- **Description**: Programmatically addresses ambiguity constraints.
- **Input**: A query whose intent was classified exactly as `CLARIFY`, or a retrieval pass resulting in 0 matching vectors.
- **Processing**: Prompts a fast LLM model (`gpt-4o-mini`) outlining missing information criteria (e.g., batch years, precise degree levels) via the `CLARIFICATION_MESSAGE_TEMPLATE`.
- **Output**: Returns a user-friendly conversational question suggesting exactly what programmatic details the user should provide to improve results.

**FR8: Query Decomposition**
- **Description**: Splits multi-part questions into individual context streams.
- **Input**: A complex, multi-variable query designated as `DECOMPOSE` by the classifier.
- **Processing**: The `decomposer_model` processes the string, generating an array of up to a hardcoded maximum of 3 explicit sub-queries.
- **Output**: Executes completely independent RAG retrieval loops for each sub-query, natively appending the aggregate results to a unified state pool.

**FR9: Contextual Query Enhancement**
- **Description**: Reformulates input considering previous chat conversations (`query_enhancer.py`).
- **Input**: The raw user string bound to a `session_id`.
- **Processing**: Validates existing memory from `Redis`. If prior conversation exists, it extracts antecedents and expands pronouns creating a fully standalone, stateless search string.
- **Output**: Passes a semantically complete paragraph downstream for dense semantic database searching.

---

### **Retrieval & Processing**

**FR10: Hybrid Search Mechanism**
- **Description**: Executes vector similarity retrievals over embedded datasets.
- **Input**: The finalized processed query string targeting a given `namespace`.
- **Processing**: `retriever.py` simultaneously searches Pinecone (dense cosine-based similarities via `text-embedding-3-large`) and the local BM25 keyword index (Sparse). It applies weighted rankings, typically 0.7 Dense / 0.3 Sparse. 
- **Output**: Yields a sorted array of the highest-value document chunk dictionaries.

**FR11: Agentic Chunk Grading and Self-Correction**
- **Description**: Evaluates search quality natively using a feedback loop.
- **Input**: Retrieved context array returned from the Hybrid method.
- **Processing**: The `ChunkGrader` node flags each snippet `relevant` vs `irrelevant`. If the minimum required confidence (`avg_confidence_threshold > 0.70`) is unsatisfied, the `QueryRewriter` adapts the search variables and automatically queries again (up to `max_retries=5`).
- **Output**: Commits only humanly verified contextual snippets into the final `AgentState`.

**FR12: Context-Aware Response LLM Generation**
- **Description**: Drafts final factual responses heavily biased to prompt limits.
- **Input**: Concatenated strings of all validated, relevant data snippets passed alongside strict domain constraints (system prompts found in `/system_prompts`).
- **Processing**: Constructs final context messages enforcing low output entropy (`temperature=0.1`) requesting OpenAI inference pipelines to isolate answers structurally tied to original sources.
- **Output**: Creates standard completion block texts representing accurate documentation answers.

**FR13: Server-Sent Events (SSE) Streaming Format**
- **Description**: Formats the final text for dynamic UI rendering. 
- **Input**: Streaming request triggered to `POST /api/chat/stream`.
- **Processing**: Wraps the generator inside the FastAPI endpoint logic, constantly yielding structured byte chunks mapped (`{"type": "token", "content": "..."}`).
- **Output**: Allows the React hook to progressively render type-writing mechanics locally before the API call fully terminates with `[DONE]`.

**FR14: Post-Generation Hallucination Guard**
- **Description**: Conducts an end-of-chain text integrity check matching generated concepts precisely to raw metadata chunks. 
- **Input**: The fully rendered response string interacting against the originally accepted context array. 
- **Processing**: The `HallucinationGuard` invokes a model calculating grounding scores. If calculated score falls below the predefined static scalar (`hallucination_threshold=0.5`)...
- **Output**: Programmatically edits the output payload forcibly appending a disclaimer: `*Note: Some details in this response may not be directly verified...*`.

---

### **Memory, Observability & Data Pipeline**

**FR15: Short-Term Memory Server Side Cache**
- **Description**: Persists active conversational session states across stateless networks.
- **Input**: Completed Request/Response exchanges bearing standard `session_ids`.
- **Processing**: Connects to the Redis Cloud endpoint variables pushing memory structures limited internally by TTL bounds (`1800` seconds / 30 mins) and explicit turn limits (`10` turns).
- **Output**: Makes prior conversation texts seamlessly available for subsequent Query Enhancing iterations.

**FR16: Generative Telemetry Tracing**
- **Description**: Extensively logs tree-execution timings and metrics outside the container.
- **Input**: API executions operating inside environments carrying `LANGCHAIN_API_KEY`.
- **Processing**: Decorators mapping to routines (e.g. `@traceable(name="agentic_rag.run")`) natively trace logic trees parsing out total duration, sub-node loops, and actual token-billing costs.
- **Output**: Dispatches asynchronous API post payloads reflecting system telemetry to the external LangSmith tracking dashboard.

**FR17: Evaluative Feedback Pipeline**
- **Description**: Processes user-supplied evaluation data marking inference quality.
- **Input**: Boolean feedback payload arrays (`run_id` and parameter `score`) POSTed from the UI.
- **Processing**: Initiates a sequence binding the explicit `score` scalar back directly to the corresponding UUID run via Langsmith, whilst simultaneously catching local environments to log backup physical JSON files (`feedback_log.jsonl`).
- **Output**: Concludes storing data persistently for further pipeline fine-tuning and outputs standard JSON `{"status": "ok"}` success states.

**FR18: Graceful Exception Handling Strategy**
- **Description**: Natively catches fatal constraints blocking application crashes.
- **Input**: Missing database limits, dead environment keys, unprocessable JSON inputs, or underlying HTTP standard 429 Limit failures.
- **Processing**: Binds exceptions using `try/except` mapping inside top-level routing, interpreting ValueError variables into standard explicit response code bindings (e.g., status 400 or 500).
- **Output**: Suppresses pure stack traces and surfaces safe descriptive error payloads cleanly to frontend mapping components (`{"type": "error", "message": "..."}`).

**FR19: Centralized Configuration Management**
- **Description**: Dynamically governs behavior via system variables.
- **Input**: `.env` declaration files mounted at root scopes mapping to string dictionaries. 
- **Processing**: The `config.py` classes absorb environment files immediately, forcing fallback bindings on non-populated fields (e.g., `os.getenv("DEFAULT_TOP_K_RETRIEVE", "5")`).
- **Output**: Controls pipeline parameters globally without requiring source-code compilations.

**FR20: Offline Document Ingestion Execution**
- **Description**: Standalone functionality populating retrieval indices prior to querying. 
- **Input**: Folder paths designated containing physical University `.pdf` binary files. 
- **Processing**: `pinecone_ingestion.py` extracts strings utilizing `pytesseract` and `pdfplumber`, subdivides context via specific semantic regex logic per unique namespace schema, extracts contextual metadata objects, vectors data against `text-embedding-3-large`, and deduplicates using progress sets. 
- **Output**: Executes standard upsert payloads batch processing raw files into Pinecone mapping indices safely tracking completed elements in `processed_files.json`.
