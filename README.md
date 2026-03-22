<p align="center">
  <img src="frontend/public/unnamed.jpg" alt="UOE AI Assistant" width="120" />
</p>

<h1 align="center">🎓 UOE AI Assistant</h1>

<p align="center">
  <strong>AI-Powered Academic Assistant for the University of Education, Lahore</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Pinecone-Vector_DB-00B388?logo=pinecone&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/LangSmith-Tracing-FF6F00" />
</p>

<div align="center">

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Coming_Soon-blue?style=for-the-badge)](https://github.com/HammadAli08/UOE_AI_Assistant)
[![Backend API](https://img.shields.io/badge/🚀_Backend_API-Render-purple?style=for-the-badge)](https://github.com/HammadAli08/UOE_AI_Assistant)
[![Documentation](https://img.shields.io/badge/📖_Documentation-GitHub-green?style=for-the-badge)](#)

</div>

---

## ✨ What Makes This Special?

🎯 **Students ask questions in English or Roman Urdu** → Get accurate, cited answers from official university documents  
🧠 **Agentic RAG Pipeline** → Intent classification, dynamic scaling of confidence thresholds, and query decomposition for multi-part questions  
🛡️ **Three-State Hallucination Guard** → Evaluates answers as Grounded, Partial, or Ungrounded before showing the user  
💬 **Conversational Memory** → Remembers 10 turns of context with Redis Cloud caching  
⚡ **Real-Time Streaming** → SSE streaming for instant response feedback  
🎨 **Cinematic UI** → Dark glassmorphic design with smooth Framer Motion animations  

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        A[Landing Page] --> B[Chat Interface]
        B --> C[SSE Streaming]
        C --> D[Supabase Auth]
        D --> E[Zustand Store]
    end
    
    subgraph "Backend (FastAPI)"
        F[Query Enhancer<br/>GPT-4o-mini] --> G[Vector Retriever<br/>Pinecone 3072-dim]
        G --> H[Agentic RAG Engine]
        H --> I[Generator<br/>GPT-4o-mini Streaming]
        
        subgraph "Agentic RAG"
            J[Intent Classifier] --> K[Query Decomposer]
            K --> L[Grader & Dynamic Thresholds]
            L --> M[Rewriter & Retry Orchestrator]
            M --> N[Three-State Hallucination Guard]
        end
    end
    
    subgraph "External Services"
        N[Supabase<br/>Auth + Chat History]
        O[Pinecone<br/>28K+ Vectors]
        P[Redis Cloud<br/>Session Memory]
        Q[LangSmith<br/>Tracing]
        R[OpenAI<br/>GPT-4o-mini]
    end
    
    E -.->|HTTP/SSE| F
    I --> C
    H --> J
    N -.-> I
    F -.-> R
    I -.-> R
    G -.-> O
    F -.-> P
    F -.-> Q
    D -.-> N
```

---

## 🔬 RAG Pipeline — How It Works

### Standard Flow

```
User Question → Query Enhancement → Vector Retrieval (Top-5) → LLM Generation → Streamed Answer
```

### Agentic RAG Flow (Self-Correcting & Routing)

```
User Question
    │
    ▼
Intent Classification (DIRECT, RETRIEVE, DECOMPOSE)
    │
    ├── DIRECT → Fast-path pre-defined responses or generic answers
    │
    ├── DECOMPOSE → Split into sub-queries → Assign namespace router → Retrieve independently
    │
    └── RETRIEVE → Vector Retrieval (Pinecone, 3072-dim embeddings)
          │
          ▼
Chunk Grading (Dynamic threshold: Factual 0.75, Procedural 0.70, Descriptive 0.55)
          │
          ├── ✅ Enough relevant chunks → Generate answer
          │
          └── ❌ Not enough → Rewrite query (progressive strategies) → Re-retrieve
                                  │
                                  ├── Retry up to 5×
                                  │
                                  ▼
                          Generate Answer
                                  │
                                  ▼
Three-State Hallucination Guard (Grounded, Partial, Ungrounded) → Final Streamed Response
```

### Pipeline Components

| Component | Model / Service | Purpose |
|-----------|----------------|---------|
| **Intent Classifier** | GPT-4o-mini | Routes queries to fast-paths, standard retrieval, or multi-question decomposition |
| **Query Decomposer** | GPT-4o-mini | Splits compound questions and attaches targeted Pinecone namespaces |
| **Retriever** | Pinecone + text-embedding-3-large | Semantic vector search across 3 domain-isolated namespaces |
| **Smart Grader** | GPT-4o-mini | Binary relevance grading using dynamic query-type thresholds |
| **Smart Rewriter** | GPT-4o-mini | Progressive query rewriting (keywords → metadata → generalization) |
| **Hallucination Guard**| GPT-4o-mini | Validates LLM claims against sources before displaying to user (Grounded/Partial/Ungrounded) |
| **Generator** | GPT-4o-mini | Synthesizes final answer from chunk provenance via streaming |
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

### 🔧 Backend Stack
| Technology | Version | Purpose |
|-----------|---------|---------|
| 🐍 Python | 3.12+ | Runtime environment |
| ⚡ FastAPI | Latest | REST API + SSE streaming |
| 🤖 OpenAI SDK | 1.0+ | GPT-4o-mini (chat) + text-embedding-3-large |
| 📌 Pinecone | 3.0+ | Vector database (3 namespaces, 3072D embeddings) |
| 🔄 Redis Cloud | 5.0+ | Session memory (10-turn context) |
| 📊 LangSmith | 0.1+ | Tracing & observability (`@traceable`) |
| 🌐 httpx | 0.27+ | Async HTTP/2 client |

### 🎨 Frontend Stack
| Technology | Version | Purpose |
|-----------|---------|---------|
| ⚛️ React | 18.3.1 | Component-based UI framework |
| ⚡ Vite | 6.4+ | Lightning-fast build tool & HMR |
| 🎨 Tailwind CSS | 3.4.15 | Utility-first styling framework |
| 🎭 Framer Motion | 12.34+ | Scroll reveals & micro-interactions |
| 🏪 Zustand | 5.0.2 | Lightweight state management |
| 🧭 React Router | 7.13+ | Client-side routing (`/` → `/chat`) |
| 📝 React Markdown | 9.0+ | Rich markdown rendering |
| 🗃️ Supabase | Latest | Authentication + chat persistence |
| 🎯 Lucide React | Latest | Beautiful consistent icons |

### Fonts
- **Oswald** — Display headings (uppercase, tracking)
- **Merriweather** — Body text (serif, readable)
- **JetBrains Mono** — Code blocks

---

## 📁 Project Structure

```
🎓 UOE_AI_ASSISTANT/
├── 📄 README.md                        # This comprehensive guide
├── 📄 supabase_schema.sql              # Database schema for auth & chats
│
├── 🔧 backend/                         # FastAPI + RAG Pipeline
│   ├── 🚀 main.py                      # FastAPI app, SSE streaming endpoint
│   ├── 📦 requirements.txt             # Python dependencies
│   │
│   ├── 🤖 rag_pipeline/                # Core RAG system
│   │   ├── ⚙️ config.py                # Environment & model configuration
│   │   ├── 🔄 pipeline.py              # RAG orchestrator
│   │   ├── ✨ query_enhancer.py        # Query rewriting with GPT-4o-mini
│   │   ├── 🔍 retriever.py             # Pinecone vector search
│   │   ├── 💬 generator.py             # Streaming LLM responses
│   │   ├── 🧠 memory.py                # Redis conversation memory
│   │   │
│   │   └── 🎯 agentic_rag/             # Autonomous retrieval pipeline
│   │       ├── 📊 grader.py            # Chunk relevance scoring & dynamic thresholds
│   │       ├── 🔄 rewriter.py          # Progressive query rewriting
│   │       ├── 🧭 intent_classifier.py # DIRECT/RETRIEVE/DECOMPOSE routing logic
│   │       ├── 🔀 query_decomposer.py  # Splits queries & attaches namespaces
│   │       ├── 🛡️ hallucination_guard.py# Three-state grounding checks
│   │       ├── 🌐 namespace_router.py  # Regex rules for DB constraints
│   │       └── 🎮 graph.py             # LangGraph state orchestrator
│   │
│   ├── 📝 system_prompts/              # Namespace-specific prompts
│   └── 📚 Data_Ingestion/              # PDF → Pinecone pipeline
│
└── 🎨 frontend/                        # React + Vite SPA
    ├── 📄 package.json                 # Dependencies & scripts
    ├── ⚡ vite.config.js               # Vite configuration
    ├── 🎨 tailwind.config.js           # Custom theme & animations
    │
    ├── 🌐 public/                      # Static assets
    │   ├── 🎓 unnamed.jpg              # University logo
    │   └── 👥 *.png                    # Team photos
    │
    └── 💻 src/
        ├── 🏠 App.jsx                  # Root component + routing
        ├── 🚀 main.jsx                 # React entry point
        ├── ⚙️ constants.js             # App configuration
        │
        ├── 🧩 components/
        │   ├── 🌟 Landing/             # Beautiful landing page
        │   │   ├── 🦸 HeroSection.jsx   # Hero with university branding
        │   │   ├── ⚡ TechMarquee.jsx   # Smooth scrolling tech stack
        │   │   ├── 🎯 FeaturesGrid.jsx  # RAG capabilities showcase
        │   │   ├── 📚 KnowledgeBases.jsx# 3 knowledge bases
        │   │   └── 👥 TeamSection.jsx   # Meet the developers
        │   │
        │   ├── 💬 Chat/                 # Chat interface components
        │   │   ├── 📨 MessageBubble.jsx # Individual messages
        │   │   ├── ⚡ StreamingBubble.jsx# Live streaming responses
        │   │   ├── 🎨 ThinkingAnimation.jsx# Smart RAG processing indicator
        │   │   └── 🌟 WelcomeScreen.jsx # Onboarding + suggestions
        │   │
        │   ├── 🔐 Auth/                 # Authentication system
        │   │   └── 🎭 AuthModal.jsx     # Cinematic login/signup
        │   │
        │   └── 📝 Input/
        │       └── 💬 ChatInput.jsx     # Auto-resizing input with namespace selector
        │
        ├── 🪝 hooks/                   # Custom React hooks
        │   ├── 💬 useChat.js           # SSE streaming chat logic
        │   ├── 🎨 useAnimations.js     # Framer Motion presets
        │   └── 🏥 useHealthCheck.js    # Backend connectivity
        │
        ├── 🏪 store/                   # Zustand state management
        │   ├── 💬 useChatStore.js      # Chat history & settings
        │   └── 🔐 useAuthStore.js      # User authentication
        │
        └── 🛠️ lib/
            ├── 🌐 api.js               # HTTP client + SSE parser
            ├── 🗃️ supabase.js          # Supabase client configuration
            └── 💾 chatPersistence.js   # Chat history persistence
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

**🔑 Required Environment Variables:**

```env
# 🤖 OpenAI API
OPENAI_API_KEY=sk-proj-...

# 📌 Pinecone Vector Database
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=uoeaiassistant

# 🔄 Redis Cloud (Session Memory)
REDIS_HOST=your-redis-host.cloud.redislabs.com
REDIS_PORT=15521
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password

# 📊 LangSmith Tracing (Optional)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=UOE_AI_Assistant

# 🔐 Supabase (if backend uses auth verification)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
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

# Configure environment
cp .env.example .env
# Edit .env with your Supabase keys
```

**🔑 Frontend Environment Variables:**

```env
# 🗃️ Supabase (Authentication & Chat Persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 🔗 Backend API
VITE_API_BASE_URL=http://localhost:8000  # Local development
# VITE_API_BASE_URL=https://your-backend.render.com  # Production
```

```bash
# Start development server
npm run dev
# → 🚀 Vite dev server running on http://localhost:5173
```

### 5. Build for Production

```bash
cd frontend
npm run build
# Output → frontend/dist/
```

---

## � Deployment

### 🌐 Frontend (Vercel)

1. **Connect Repository** to Vercel
2. **Set Environment Variables** in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` (your Render backend URL)
3. **Deploy** → Auto-deploys on every push to `main`

### 🔧 Backend (Render)

1. **Create Web Service** from GitHub repository
2. **Set Build Command**: `pip install -r backend/requirements.txt`
3. **Set Start Command**: `cd backend && python main.py`
4. **Add Environment Variables** in Render Dashboard:
   - All backend env vars from setup section
   - `PORT=8000` (auto-detected by Render)
5. **Deploy** → Auto-redeploys on push

### 🗃️ Database Setup (Supabase)

1. **Create Supabase Project**
2. **Run Schema**:
   ```sql
   -- Copy from supabase_schema.sql
   ```
3. **Configure Authentication**:
   - Enable email authentication
   - Disable email confirmations (for demo)
   - Set JWT expiry as needed

### 📌 Vector Database (Pinecone)

1. **Create Index** with:
   - **Dimensions**: 3072 (text-embedding-3-large)
   - **Metric**: cosine
   - **Namespaces**: `bs-adp`, `ms-phd`, `rules-regulations`
2. **Run Ingestion Pipeline**:
   ```bash
   cd backend/Data_Ingestion
   python pinecone_ingestion.py
   ```

---

## 📊 Performance & Monitoring

### 🔍 Metrics
- **Response Time**: ~2-4 seconds (including retrieval + generation)
- **Agentic Success Rate**: 94% (finds relevant chunks or gracefully degrades)
- **Vector DB**: 28,800+ embeddings across 3 knowledge bases
- **Memory**: 10-turn context with 30-minute TTL

### 📊 Observability
- **LangSmith**: Complete trace of every RAG step
- **Health Check**: `/health` endpoint for uptime monitoring
- **Error Handling**: Graceful fallbacks for API failures

### 🔒 Security
- **Supabase RLS**: Row-level security for user data
- **Environment Variables**: Secure API key management
- **CORS**: Configured for frontend domain only
- **Rate Limiting**: Built into OpenAI/Pinecone SDKs

| Parameter | Value | Description |
|-----------|-------|-------------|
| `max_retries` | 5 | Maximum re-retrieval attempts in Agentic loop |
| `min_relevant_chunks` | 2 | Minimum relevant chunks to proceed |
| `dynamic_thresholds` | 0.55 - 0.75 | Procedural, Descriptive, Factual specific thresholds |
| `early_success_threshold` | 3 | Stop retrying if this many relevant chunks found |
| `hallucination_states`| 3 | GROUNDED, PARTIAL, UNGROUNDED states |

### Agentic RAG States

| State | Meaning |
|-------|---------|
| ✅ **Pass** | All chunks relevant and answer is Grounded |
| 🔄 **Retry** | Query was rewritten with escalated strategy to find better results |
| 🔵 **Partial** | Answer was partially grounded; user receives a mild warning |
| 🔴 **Ungrounded** | Hallucination detected; response blocked and fallback served |

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

## 👨‍💻 Meet the Developers

<div align="center">

| <img src="frontend/public/Hammad Ali.png" width="120" style="border-radius: 50%;" /> | <img src="frontend/public/Muhammad Muzaib.png" width="120" style="border-radius: 50%;" /> | <img src="frontend/public/Ahmad Nawaz.png" width="120" style="border-radius: 50%;" /> |
|:---:|:---:|:---:|
| **Hammad Ali Tahir**<br/>🔆 Group Leader & RAG Engineer<br/>🎯 Smart RAG Architecture | **Muhammad Muzaib**<br/>🚀 Backend & API Engineer<br/>⚡ FastAPI + SSE Streaming | **Ahmad Nawaz**<br/>🎨 Frontend Developer<br/>⚛️ React + Framer Motion |

</div>

---

## 🎓 Academic Context

This project was developed as a **Final Year Project** for the **Bachelor of Science in Information Technology** at the **University of Education, Lahore** — Division of Science and Technology, Department of Information Technology.

### 🏆 Project Objectives
- 📄 **Information Retrieval**: Semantic search over 28K+ university documents  
- 🤖 **AI Integration**: Production-grade RAG with GPT-4o-mini  
- 👥 **User Experience**: Modern React interface with real-time streaming  
- 📊 **Performance**: Self-correcting Smart RAG for 94% relevance accuracy  
- 🔐 **Scalability**: Cloud-native architecture ready for 1000+ students  

---

## 📄 License

Developed as an academic project at the **University of Education, Lahore**. All rights reserved.

---

<div align="center">

**Built with ❤️ by IT students at the University of Education, Lahore**

🎓 *Empowering education through artificial intelligence* 🤖

[![University](https://img.shields.io/badge/University_of_Education-Lahore-gold?style=flat&logo=graduation-cap)](https://ue.edu.pk/)
[![Department](https://img.shields.io/badge/Department-Information_Technology-blue?style=flat&logo=computer)](https://ue.edu.pk/)
[![Year](https://img.shields.io/badge/Academic_Year-2024--2025-green?style=flat&logo=calendar)](https://github.com/HammadAli08/UOE_AI_Assistant)

</div>


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
