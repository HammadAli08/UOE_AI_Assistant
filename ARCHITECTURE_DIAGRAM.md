# System Architecture Diagram
**Figure 4.1: UOE AI Assistant Architecture**

You can copy this Mermaid.js code directly into your Final Year Project documentation (Notion, GitHub, Obsydian, or any markdown viewer supporting Mermaid). It will automatically render as a professional technical flowchart.

```mermaid
graph TD
    %% Styling Definitions
    classDef frontend fill:#e1f5fe,stroke:#039be5,stroke-width:2px,color:#01579b;
    classDef backend fill:#e8f5e9,stroke:#43a047,stroke-width:2px,color:#1b5e20;
    classDef datastore fill:#fff3e0,stroke:#fb8c00,stroke-width:2px,color:#e65100;
    classDef external fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#4a148c;

    %% 1. PRESENTATION LAYER
    subgraph Client [Presentation Layer]
        SPA[React SPA Frontend]:::frontend
    end

    %% 2. APPLICATION LAYER
    subgraph AppServer [Application Layer]
        API[FastAPI Backend Backend API]:::backend
    end

    %% 3. DATA PERSISTENCE LAYER
    subgraph Database [Data & Persistence Layer]
        Supabase[(Supabase PostgreSQL)]:::datastore
        Redis[(Redis In-Memory Cache)]:::datastore
        Pinecone[(Pinecone Vector DB)]:::datastore
    end

    %% 4. EXTERNAL SERVICES LAYER
    subgraph Services [External APIs & Telemetry]
        OpenAI((OpenAI API)):::external
        LangSmith((LangSmith Observability)):::external
    end

    %% CONNEctions & Flows
    SPA -->|"REST API & SSE Streams"| API
    SPA -->|"Long-term Chat Sync (JS Client)"| Supabase
    
    API -->|"Semantic Search / RAG Vectors"| Pinecone
    API -->|"Short-term Session Context"| Redis
    
    API -->|"Prompt Generation & Grading"| OpenAI
    API -->|"Trace Logging & Evaluation"| LangSmith
```

### Flow Breakdown for Documentation:
1. **React SPA (Frontend)**: Handles the user interface, maintains real-time Server-Sent Events (SSE) connections with the backend, and directly interfaces with Supabase to persist long-term chat histories.
2. **FastAPI (Backend)**: Operates as the stateless orchestration layer executing the Agentic RAG graph logic.
3. **Data Layer**: 
    - **Pinecone**: Performs high-speed vector proximity searches across distinct program namespaces.
    - **Redis**: Maintains short-lived buffers of prior conversational history to give the LLM memory without hitting disk.
    - **Supabase**: Relational persistence engine exclusively enforcing user-tenant isolation via RLS.
4. **External APIs**: 
    - **OpenAI**: The core inference engine powering generative rewrites, context generation, and hallucination scoring.
    - **LangSmith**: Injected throughout the FastAPI graph nodes tracking token latency and debugging traces.
