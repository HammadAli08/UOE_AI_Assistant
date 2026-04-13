# Data Flow Diagram (DFD) Level 1
**Figure 4.3: DFD Level 1 (Internal System Processes)**

You can copy this Mermaid.js code directly into your Final Year Project documentation. This diagram expands the Level 0 Context diagram to reveal the internal state machine (Agentic RAG) components and data pipelines.

```mermaid
graph TD
    %% Styling Definitions
    classDef process fill:#e8f5e9,stroke:#43a047,stroke-width:2px,color:#1b5e20,shape:circle;
    classDef datastore fill:#fff3e0,stroke:#fb8c00,stroke-width:2px,color:#e65100;
    classDef externalEntity fill:#e1f5fe,stroke:#039be5,stroke-width:2px,color:#01579b;

    %% External Entity
    User((User / Student)):::externalEntity

    %% Data Stores
    D1[(D1: Redis Memory)]:::datastore
    D2[(D2: Pinecone DB)]:::datastore

    %% Processes
    P1((1.0<br/>Query<br/>Enhancement)):::process
    P2((2.0<br/>Intent<br/>Classification)):::process
    P3((3.0<br/>Hybrid<br/>Retrieval)):::process
    P4((4.0<br/>Chunk<br/>Grading)):::process
    P5((5.0<br/>LLM<br/>Generation)):::process
    P6((6.0<br/>Hallucination<br/>Check)):::process
    P7((7.0<br/>SSE payload<br/>Stream)):::process

    %% Data Flows
    User -->|"Raw Prompt"| P1
    D1 -.->|"Fetch Conversational History"| P1
    
    P1 -->|"Rewritten Contextual Query"| P2
    P2 -->|"Intent Tag (e.g., retrieval_required)"| P3
    
    D2 -.->|"Fetch Top-K Vectors"| P3
    P3 -->|"Raw Document Chunks"| P4
    
    P4 -->|"Filter Irrelevant Chunks"| P4
    P4 -->|"Graded Context Array"| P5
    
    P5 -->|"Generated LLM Draft"| P6
    
    P6 -->|"If Failed: Trigger Rewrite"| P1
    P6 -->|"If Grounded: Final Payload"| P7
    
    P7 -->|"Real-Time Markdown Stream"| User
```

### Flow Breakdown for Documentation:
- **1.0 Query Enhancement**: Receives the raw user input and pulls past session turns from the Redis Datastore to rewrite the question comprehensively.
- **2.0 Intent Classification**: Determines if the query requires external vector knowledge or if it is a general chat greeting.
- **3.0 Hybrid Retrieval**: Executes a dense/sparse query across Pinecone namespaces generating raw context chunks.
- **4.0 Chunk Grading**: Filters the raw vectors, dropping off-topic chunks to maximize context window relevancy.
- **5.0 LLM Generation**: Prompts the LLM strictly bound against the graded document array.
- **6.0 Hallucination Check**: A post-generation verification loop. If the assistant invents answers, the flow is thrown backward into a rewrite/retry cycle. 
- **7.0 SSE Stream**: Server-Sent Events controller beaming the finalized markdown packets incrementally back to the user interface.
