<p align="center">
  <img src="frontend/public/unnamed.jpg" alt="UOE AI Assistant" width="120" />
</p>

<h1 align="center">UOE AI Assistant</h1>

<p align="center">
  <strong>AI-Powered Academic Assistant for the University of Education, Lahore</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Pinecone-Vector_DB-00B388?logo=pinecone&logoColor=white" />
  <img src="https://img.shields.io/badge/LangSmith-Tracing-FF6F00" />
</p>

---

## 📌 Overview

**UOE AI Assistant** is a production-grade Retrieval-Augmented Generation (RAG) chatbot that helps students of the University of Education, Lahore navigate academic programs, admissions, fee structures, and university regulations.

Students ask questions in **English or Roman Urdu**, and the system retrieves accurate, cited answers grounded in **official university documents** — no hallucinations, no guesswork.

### Key Highlights

- 🧠 **Self-Correcting Smart RAG** — grades every retrieved chunk, rewrites queries, and retries up to 6× until relevant results are found
- 🔍 **3 Curated Knowledge Bases** — BS/ADP Programs, MS/PhD Programs, Rules & Regulations
- 💬 **Conversational Memory** — Redis-powered multi-turn context (10 turns, 30 min TTL)
- ⚡ **Streaming Responses** — real-time SSE streaming for instant user feedback
- 📊 **Full Observability** — LangSmith tracing on every retrieval and generation step
- 🎨 **Cinematic Dark UI** — Framer Motion animations, responsive design, glassmorphic components

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + Vite)               │
│  Landing Page → Chat Interface → Streaming SSE → State (Zustand)│
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────▼─────────────────────────────────────┐
│                     FASTAPI BACKEND (:8000)                      │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐  │
│  │    Query      │   │   Retriever  │   │    Generator        │  │
│  │   Enhancer    │──▶│  (Pinecone)  │──▶│  (GPT-4o-mini)     │  │
│  │  (GPT-4o-mini)│   │  3072-dim    │   │  Streaming SSE     │  │
│  └──────────────┘   └──────┬───────┘   └─────────────────────┘  │
│                             │                                    │
│                    ┌────────▼────────┐                           │
│                    │   Smart RAG     │                           │
│                    │  ┌────────────┐ │                           │
│                    │  │  Grader    │ │  Grade each chunk         │
│                    │  │  Rewriter  │ │  Rewrite if weak          │
│                    │  │  Processor │ │  Retry up to 6×           │
│                    │  └────────────┘ │                           │
│                    └─────────────────┘                           │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐  │
│  │    Redis      │   │   Pinecone   │   │    LangSmith        │  │
│  │   Memory      │   │  Vector DB   │   │    Tracing          │  │
│  │  (10 turns)   │   │  (28K+ vecs) │   │  @traceable         │  │
│  └──────────────┘   └──────────────┘   └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔬 RAG Pipeline — How It Works

### Standard Flow

```
User Question → Query Enhancement → Vector Retrieval (Top-5) → LLM Generation → Streamed Answer
```

### Smart RAG Flow (Self-Correcting)

```
User Question
    │
    ▼
Query Enhancement (GPT-4o-mini rewrites for optimal retrieval)
    │
    ▼
Vector Retrieval (Pinecone, 5 docs, 3072-dim embeddings)
    │
    ▼
Chunk Grading (GPT-4o-mini scores each chunk as relevant/irrelevant)
    │
    ├── ✅ ≥2 relevant chunks → Generate answer
    │
    └── ❌ <2 relevant → Rewrite query → Re-retrieve → Re-grade
                              │
                              └── Retry up to 6× with progressive strategy
                                      │
                                      ├── Found enough → Generate answer
                                      ├── Some found → Best-effort answer
                                      └── Zero found → Clarification / Fallback
```

### Pipeline Components

| Component | Model / Service | Purpose |
|-----------|----------------|---------|
| **Query Enhancer** | GPT-4o-mini | Rewrites user queries for better retrieval (handles Roman Urdu) |
| **Retriever** | Pinecone + text-embedding-3-large (3072d) | Semantic vector search across 3 namespaces |
| **Smart Grader** | GPT-4o-mini | Binary relevance grading of each retrieved chunk |
| **Smart Rewriter** | GPT-4o-mini | Progressive query rewriting when results are weak |
| **Generator** | GPT-4o-mini | Synthesizes final answer from relevant chunks via streaming |
| **Memory** | Redis Cloud | 10-turn conversational context with 30-min TTL |

---

## 📂 Knowledge Bases

| Namespace | Documents | Vectors | Content |
|-----------|-----------|---------|---------|
| 🎓 `bs-adp-schemes` | BS & ADP Programs | ~20,000 | Course outlines, CLOs, prerequisites, fee structures |
| 🔬 `ms-phd-schemes` | MS & PhD Programs | ~7,300 | Postgrad eligibility, research requirements, credit hours |
| 📋 `rules-regulations` | University Policies | ~1,600 | Attendance, grading, exam procedures, hostel rules |

**Total: ~28,800 vectors** from 141 PDF source files with 0% ingestion failure rate.

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12+ | Runtime |
| FastAPI | Latest | REST API + SSE streaming |
| OpenAI SDK | 1.0+ | GPT-4o-mini (chat) + text-embedding-3-large (embeddings) |
| Pinecone | 3.0+ | Vector database (3 namespaces, 3072 dimensions) |
| Redis Cloud | 5.0+ | Short-term conversational memory |
| LangSmith | 0.1+ | Tracing & observability (`@traceable` on all pipeline steps) |
| httpx | 0.27+ | HTTP/2 client |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| Vite | 6.4+ | Build tool & dev server |
| Tailwind CSS | 3.4.15 | Utility-first styling |
| Framer Motion | 12.34+ | Scroll animations & transitions |
| Zustand | 5.0.2 | Global state management |
| React Router | 7.13+ | Client-side routing (`/` → landing, `/chat` → chat) |
| React Markdown | 9.0+ | Markdown rendering in chat bubbles |

### Fonts
- **Oswald** — Display headings (uppercase, tracking)
- **Merriweather** — Body text (serif, readable)
- **JetBrains Mono** — Code blocks

---

## 📁 Project Structure

```
UOE_AI_ASSISTANT/
├── README.md
│
├── backend/
│   ├── main.py                          # FastAPI app, SSE streaming endpoint
│   ├── requirements.txt                 # Python dependencies
│   ├── pyproject.toml                   # Project metadata
│   │
│   ├── rag_pipeline/
│   │   ├── config.py                    # Central configuration (env vars, models, keys)
│   │   ├── pipeline.py                  # RAG orchestrator (enhance → retrieve → generate)
│   │   ├── query_enhancer.py            # GPT-4o-mini query rewriting
│   │   ├── retriever.py                 # Pinecone vector search + embedding cache
│   │   ├── generator.py                 # Streaming LLM generation
│   │   ├── memory.py                    # Redis conversational memory
│   │   │
│   │   └── smart_rag/                   # Self-correcting retrieval system
│   │       ├── config.py                # Smart RAG constants (6 retries, thresholds)
│   │       ├── grader.py                # Chunk relevance grading
│   │       ├── rewriter.py              # Progressive query rewriting
│   │       └── processor.py             # Orchestrates grade → rewrite → retry loop
│   │
│   ├── system_prompts/                  # Namespace-specific system prompts
│   │   ├── bs_adp_systemprompt.txt
│   │   ├── ms_phd_systemprompt.txt
│   │   ├── rules&regulations.txt
│   │   ├── query_enhancer_prompt.txt
│   │   ├── smart_grading_prompt.txt
│   │   └── smart_rewrite_prompt.txt
│   │
│   └── Data_Ingestion/
│       ├── pinecone_ingestion.py        # PDF → chunks → embeddings → Pinecone
│       ├── DOCUMENTATION.md             # Ingestion pipeline docs
│       └── processed_files.json         # Deduplication tracking
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    │
    ├── public/                          # Static assets (logos, team photos)
    │
    └── src/
        ├── App.jsx                      # Root component + routing
        ├── main.jsx                     # React entry point (BrowserRouter)
        ├── constants.js                 # Namespaces, suggestions, config
        ├── index.css                    # Tailwind + custom animations
        │
        ├── components/
        │   ├── Landing/                 # 8-section landing page
        │   │   ├── HeroPage.jsx         # Page assembler
        │   │   ├── Navbar.jsx           # Navigation bar
        │   │   ├── HeroSection.jsx      # Hero with stats
        │   │   ├── TechMarquee.jsx      # Scrolling tech badges
        │   │   ├── FeaturesGrid.jsx     # Feature cards
        │   │   ├── HowItWorks.jsx       # 3-step process
        │   │   ├── KnowledgeBases.jsx   # Namespace showcase
        │   │   ├── TeamSection.jsx      # Team members
        │   │   ├── CTABanner.jsx        # Call-to-action
        │   │   ├── Footer.jsx           # Footer
        │   │   └── ScrollReveal.jsx     # Scroll animation wrapper
        │   │
        │   ├── Chat/                    # Chat interface
        │   │   ├── ChatContainer.jsx    # Message list + auto-scroll
        │   │   ├── MessageBubble.jsx    # Individual message
        │   │   ├── StreamingBubble.jsx  # Live streaming message
        │   │   ├── TypingIndicator.jsx  # Typing dots animation
        │   │   └── WelcomeScreen.jsx    # Welcome + suggestion chips
        │   │
        │   ├── Input/
        │   │   └── ChatInput.jsx        # Auto-resizing input bar
        │   │
        │   └── SmartRAG/
        │       └── SmartBadge.jsx       # Smart RAG status badge
        │
        ├── hooks/
        │   ├── useChat.js               # Chat logic + SSE streaming
        │   ├── useAutoResize.js         # Textarea auto-resize
        │   ├── useHealthCheck.js        # Backend health polling
        │   └── useTheme.js              # Theme management
        │
        ├── store/
        │   └── useChatStore.js          # Zustand store (chats, settings, namespace)
        │
        └── utils/
            └── api.js                   # API client + SSE parser
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Redis instance (or Redis Cloud)
- Pinecone account with index
- OpenAI API key

### 1. Clone the Repository

```bash
git clone https://github.com/HammadAli08/UOE_AI_Assistant.git
cd UOE_AI_Assistant
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your actual API keys
```

**Required Environment Variables:**

```env
# API Keys
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=uoeaiassistant

# Redis Cloud
REDIS_HOST=your-redis-host.cloud.redislabs.com
REDIS_PORT=15521
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password

# LangSmith (optional but recommended)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=RAG_FYP
```

### 3. Start the Backend

```bash
cd backend
python main.py
# → Uvicorn running on http://0.0.0.0:8000
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
# → Vite running on http://localhost:5173
```

### 5. Build for Production

```bash
cd frontend
npm run build
# Output → frontend/dist/
```

---

## 📊 Smart RAG Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `max_retries` | 6 | Maximum re-retrieval attempts |
| `min_relevant_chunks` | 2 | Minimum relevant chunks to proceed |
| `confidence_threshold` | 0.6 | Minimum score for a chunk to be "relevant" |
| `early_success_threshold` | 4 | Stop retrying if this many relevant chunks found |
| `retry_top_k_boost` | 4 | Extra chunks retrieved per retry |
| `grading_model` | gpt-4o-mini | Fast + cheap chunk grading |
| `rewriting_model` | gpt-4o-mini | Progressive query rewriting |

### Smart RAG States

| State | Meaning |
|-------|---------|
| ✅ **Pass** | All chunks relevant on first retrieval |
| 🔄 **Retry** | Query was rewritten to find better results |
| 🔵 **Best Effort** | Used best available chunks after retries |
| 🔴 **Fallback** | No relevant chunks found, general knowledge used |

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/stream` | SSE streaming chat (main endpoint) |
| `GET` | `/health` | Health check |

### Chat Request Body

```json
{
  "message": "What are the admission requirements for BS Computer Science?",
  "namespace": "bs-adp",
  "session_id": "optional-session-uuid",
  "enhance_query": true,
  "enable_smart": false,
  "top_k_retrieve": 5
}
```

### SSE Stream Events

```
data: {"type": "enhanced_query", "content": "BS Computer Science admission requirements..."}
data: {"type": "token", "content": "The"}
data: {"type": "token", "content": " admission"}
...
data: {"type": "sources", "content": [...]}
data: {"type": "smart_info", "content": {...}}
data: {"type": "done"}
```

---

## 👥 Team

<table>
  <tr>
    <td align="center">
      <img src="frontend/public/Hammad Ali.png" width="120" style="border-radius: 50%;" /><br />
      <strong>Hammad Ali Tahir</strong><br />
      <sub>Group Leader · RAG Engineer</sub>
    </td>
    <td align="center">
      <img src="frontend/public/Muhammad Muzaib.png" width="120" style="border-radius: 50%;" /><br />
      <strong>Muhammad Muzaib</strong><br />
      <sub>API Engineer</sub>
    </td>
    <td align="center">
      <img src="frontend/public/Ahmad Nawaz.png" width="120" style="border-radius: 50%;" /><br />
      <strong>Ahmad Nawaz</strong><br />
      <sub>Frontend Developer</sub>
    </td>
  </tr>
</table>

---

## 📝 License

This project was developed as a **Final Year Project** at the University of Education, Lahore — Division of Science and Technology, Department of Information Technology.

---

<p align="center">
  Built with ❤️ at the <strong>University of Education, Lahore</strong>
</p>
