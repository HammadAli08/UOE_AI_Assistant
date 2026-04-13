# We Built an AI Academic Assistant for Our FYP - and It Actually Helps Students Find Real Answers

**Final Year Project (BS Information Technology, University of Education Lahore)**  
**By:** Hammad Ali Tahir, Muhammad Muzaib, Ahmad Nawaz

---

## The Problem We Could Not Ignore

If you are a student, you already know the pain.

You need one simple answer, maybe *"What is the eligibility for BS Computer Science?"* or *"How many credit hours are required in this semester?"* and suddenly you are opening one PDF after another. Rules are in one document, schemes of study are in another, fee details somewhere else, and half the time search does not work unless you type the exact keyword.

At the University of Education Lahore, this problem is real for thousands of students. We saw classmates waste hours searching for information that should take seconds.

That became the core motivation for our Final Year Project:

**Build an AI-powered academic assistant that understands natural language and returns accurate, cited answers from official university documents.**

---

## What We Built

We developed **UOE AI Assistant**, a full-stack AI system where students can ask questions in **English or Roman Urdu** and receive fast, grounded answers.

The platform combines:

- A modern React frontend with real-time streaming responses
- A FastAPI backend for AI orchestration
- A RAG pipeline backed by Pinecone vector search
- Redis-based conversational memory
- Supabase authentication and chat persistence

Most importantly, answers are not random AI output. They are generated from retrieved university documents and include source context.

[Insert Screenshot 1 Here: Landing page of UOE AI Assistant]

---

## Our Key Idea: Smart, Self-Correcting RAG

Many projects stop at basic retrieval: search top chunks, generate answer, done.

We learned quickly that this is not enough in real student usage.

Students ask in mixed language, shorthand, and informal phrasing. For example:

- "BS CS ka criteria kya hai?"
- "MPhil admission rule bata do"
- "attendance kitni mandatory hai"

A naive pipeline fails often in these cases. So we designed what we called a **Smart RAG loop**:

1. Enhance or rewrite the query for better retrieval
2. Retrieve relevant chunks from the right knowledge namespace
3. Grade chunk relevance
4. If quality is weak, rewrite and retry with a better strategy
5. Generate final answer only when evidence is sufficient
6. Run grounding checks before displaying output

This made the system more reliable and less likely to hallucinate.

[Insert Screenshot 2 Here: Smart RAG/Agentic flow diagram]

---

## Knowledge Base We Built

We processed university documents into a structured semantic knowledge base across three domains:

- **BS/ADP Programs**
- **MS/PhD Programs**
- **Rules and Regulations**

In total, our pipeline handled a large corpus from official documents and produced a high-volume vector index for semantic search.

This separation helped in two ways:

- Better relevance (domain-specific retrieval)
- Better control over prompts and response style

[Insert Screenshot 3 Here: Namespace selector + source citations in chat UI]

---

## System Architecture (In Simple Words)

When a student sends a question:

- Frontend sends request to backend
- Backend enhances query and retrieves context from Pinecone
- LLM generates a response from retrieved evidence
- Tokens stream back live to the UI (SSE)
- Response is shown with contextual grounding and memory support

We also integrated:

- **Redis Cloud** for short-term conversation memory
- **LangSmith** for tracing and debugging pipeline behavior
- **Supabase** for authentication and user chat history

So this is not just a demo chatbot. It is a complete, deployable academic assistant pipeline.

[Insert Screenshot 4 Here: Architecture diagram (Frontend + Backend + Pinecone + Redis + Supabase)]

---

## Tech Stack We Used

**Backend**

- Python 3.12+
- FastAPI
- OpenAI models for generation and embeddings
- Pinecone vector database
- Redis Cloud

**Frontend**

- React + Vite
- Tailwind CSS
- Framer Motion
- Zustand
- Supabase client

This stack gave us a good balance of speed, modularity, and production readiness.

---

## The Hard Parts (And What We Learned)

### 1) Retrieval quality is everything
If retrieval is weak, answer quality collapses no matter how strong the model is.

### 2) Prompting alone is not enough
We needed query rewriting, chunk grading, and retries to make the pipeline robust.

### 3) Real users ask differently than test users
Roman Urdu and mixed-language queries pushed us to design beyond textbook pipelines.

### 4) Streaming improves perceived intelligence
Even when latency exists, token-by-token responses make the interaction feel alive.

### 5) Observability saved us
Tracing each step helped us diagnose where failures happened: retrieval, grading, or generation.

[Insert Screenshot 5 Here: LangSmith trace of one full query]

---

## Academic and Practical Impact

As an FYP, we wanted both research value and practical value.

This project contributes to:

- AI-based educational support in local university context
- Multilingual (English + Roman Urdu) query understanding
- Retrieval-grounded responses with citation-aware behavior
- A reusable architecture for other universities

For students, the value is immediate: faster answers, fewer document hunts, better clarity.

For institutions, this model can scale into admission support, policy navigation, and academic advising.

---

## Team and Roles

This project was built collaboratively by:

- **Hammad Ali Tahir** - Group Leader, RAG engineering and architecture
- **Muhammad Muzaib** - Backend APIs and streaming system
- **Ahmad Nawaz** - Frontend experience and interface development

Supervisor: **Dr. Muhammad Shehzad**  
Department of Information Technology, University of Education Lahore

[Insert Screenshot 6 Here: Team photo or project defense moment]

---

## What We Would Improve Next

If we continue this after FYP, our roadmap is clear:

- Full Urdu script support (beyond Roman Urdu)
- User feedback loop for answer correction
- Better cost optimization for multi-step RAG retries
- Mobile app experience
- Integration with university portal/LMS
- Voice-based querying

---

## Final Reflection

This project taught us that building an AI assistant is not about connecting an LLM and calling it done.

The real work is in **retrieval quality, guardrails, iteration loops, and user experience**.

As a Final Year Project, UOE AI Assistant became more than a technical submission. It became a practical system that solves an actual student problem in our university ecosystem.

And honestly, seeing someone ask a real question and get a correct, grounded answer in seconds made all the late nights worth it.

---

## Suggested Screenshot Checklist (Quick Reference)

1. Landing page
2. Chat interface during streaming
3. Namespace selector in action
4. Source citations under response
5. Smart RAG/Agentic pipeline diagram
6. System architecture diagram
7. LangSmith trace screenshot
8. Deployment screenshot (Render/Vercel/Supabase)
9. Team photo / FYP presentation slide

---

If you are also building an AI FYP, feel free to study this architecture and improve it for your own context.
