# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Technical Support Expert System (AI 智能技术支持系统) — an enterprise RAG-based support platform. Users ask technical questions; the system retrieves matching content from a curated, human-audited knowledge base of documents and tickets. Responses are navigational (showing original verified content), not AI-generated answers.

The UI and all user-facing text are bilingual (Chinese/English) via an i18n system.

## Development Commands

### Backend (from `backend/` directory)
```bash
python main.py                                          # Start FastAPI server (port 8000, auto-reload)
celery -A tasks.celery_app worker --loglevel=info       # Start Celery worker (requires Redis)
python ../scripts/ingest.py                             # Import sample data from data/ into ChromaDB
python ../scripts/rebuild_index.py                      # Rebuild vector index from SQLite
```

### Frontend (from `frontend/` directory)
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 5173, proxies /api to :8000)
npm run build        # TypeScript check + production build
```

### Docker
```bash
docker-compose up --build    # Full stack: backend + celery + frontend + redis
```

## Tech Stack

- Backend: Python 3.10+ / FastAPI / SQLite / ChromaDB / Celery + Redis
- Frontend: React 18 / TypeScript / Tailwind CSS 4 / Vite
- LLM: Multi-provider dispatch — Claude (Anthropic SDK), DeepSeek, DashScope/Qwen (both via OpenAI-compatible SDK)
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (local) or DashScope remote
- Auth: JWT (bcrypt passwords, default admin: `admin` / `admin123`)

## Architecture

### RAG Pipeline (backend/core/pipeline.py)

The core query flow uses a 5-stage system with three-bucket partitioning:

1. **Stage 2 (High Confidence)**: Query matches above `confidence_threshold` → show navigational guidance options grouped by AI
2. **Stage 3 (No Results)**: No matches at all → "no results" response, query logged for admin review
3. **Stage 4 (Progressive Refinement)**: Near-miss matches (between `near_miss_threshold` and `confidence_threshold`) → AI generates topic-direction options with keywords; user selects one to refine the search. Up to `max_refinement_rounds` rounds.
4. **Stage 5 (Exhausted)**: Refinement rounds exhausted, still near-miss → show approximate results with disclaimer

Vector search uses `query_dual_channel()` which searches both document fingerprints and ticket fingerprints in ChromaDB, merging results. Only items with status "已审核" (audited) are indexed.

### Multi-Provider LLM Dispatch (backend/core/llm.py)

Per-task routing: each task type (e.g. `GUIDANCE_GROUPING`, `DOC_CLEANING`, `TICKET_CLEANING`) can be routed to a different LLM provider/model via settings. Providers: `anthropic` (Claude), `deepseek`, `dashscope` (Qwen). Token usage is logged per-call to `llm_usage_log` table.

### Document/Ticket Lifecycle

Status workflow: `待处理` → `待审核` → `已审核` / `已驳回`

1. Upload/import → stored in SQLite with status `待处理`
2. Celery async task: AI cleans/parses content → status becomes `待审核`
3. Admin reviews → approves (`已审核`) or rejects (`已驳回`)
4. On approve: question fingerprints extracted and indexed into ChromaDB

### Frontend Architecture

SPA with React Router. Three-panel chat layout (left sidebar sessions, center chat, right reference panel). Pages: ChatPage, AdminDashboard, DocReviewPage, TicketReviewPage, DocsListPage, TicketsListPage, SettingsPage, LoginPage.

Key patterns:
- i18n: `frontend/src/lib/i18n.tsx` — dictionary-based, `useI18n()` hook returns `t()` function. All user-facing strings must have `zh` and `en` entries.
- API layer: `frontend/src/lib/api.ts` — all backend calls go through `apiFetch()` which handles auth headers and error responses.
- Toasts: `react-hot-toast` (global Toaster in `main.tsx`). Used in admin pages, not in chat area (chat errors are inline messages).
- Chat message roles: `user`, `ai`, `guidance` (stage 2), `solution` (stage 3), `refinement` (stage 4), `near_miss` (stage 5), `content`.

## Key Backend Modules

| Path | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, middleware, startup (DB init, admin seed) |
| `backend/core/pipeline.py` | RAG pipeline: `process_query()`, `process_refinement()`, `retrieve_content()` |
| `backend/core/llm.py` | Multi-provider LLM calls: `call_llm_simple()`, `call_llm_multimodal()` |
| `backend/core/retriever.py` | ChromaDB vector search: `query_dual_channel()`, `index_document()` |
| `backend/core/embeddings.py` | Embedding generation (local sentence-transformers or remote DashScope) |
| `backend/core/task_types.py` | `TaskType` enum for LLM routing |
| `backend/db/sqlite_db.py` | SQLite schema, migrations, `get_connection()` |
| `backend/db/settings_store.py` | System settings CRUD (thresholds, API keys, templates) |
| `backend/db/chat_store.py` | Chat session/message persistence |
| `backend/tasks/` | Celery tasks: `doc_tasks.py`, `ticket_tasks.py` (async parsing/cleaning) |
| `backend/models/schemas.py` | Pydantic models for all API request/response types |

## Environment Variables

Configured in `.env` (see `.env.example`). Key vars:
- `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `DASHSCOPE_API_KEY` — at least one LLM key required
- `REDIS_URL` — required for Celery async tasks (default: `redis://localhost:6379/0`)
- `JWT_SECRET` — auto-generated if not set
- `CORS_ORIGINS` — comma-separated (default: `http://localhost:5173`)

## Important Conventions

- Tailwind CSS 4: uses `@import "tailwindcss"` (not `@tailwind` directives)
- ChromaDB confidence formula: `1 / (1 + L2_distance)`
- Vite dev server proxies `/api` and `/uploads` to backend port 8000
- Backend auto-reloads via `uvicorn --reload` (watchfiles); frontend uses Vite HMR
- Celery tasks handle blocking operations (doc parsing, AI cleaning, approve/index) to avoid API timeouts
- No test suite exists yet; `pytest` and `httpx` are in requirements.txt but no test files have been written
