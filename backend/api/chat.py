from fastapi import APIRouter, Depends, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from models.schemas import ChatRequest, ChatResponse, RetrieveRequest, RefineRequest
from core.pipeline import process_query, retrieve_content, process_refinement
from core.auth import get_current_user, CurrentUser
from db.chat_store import upsert_session, insert_message

router = APIRouter(prefix="/api", tags=["chat"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    """Main chat endpoint with 3-stage RAG pipeline."""
    # Save user message first so pipeline can read full history from DB
    insert_message(body.session_id, "user", body.message)

    # Run pipeline (reads history + round_count from SQLite)
    response, round_count = process_query(body.session_id, body.message)

    # Persist updated round count
    upsert_session(body.session_id, round_count, user_id=user.user_id)

    # Save assistant message with sources and stage
    sources_data = [s.model_dump() for s in response.sources]
    msg_id = insert_message(
        body.session_id, "assistant", response.reply,
        stage=response.stage, sources=sources_data,
    )
    response.message_id = msg_id

    return response


@router.post("/chat/retrieve")
async def chat_retrieve(body: RetrieveRequest, user: CurrentUser = Depends(get_current_user)):
    """Retrieve full content for selected entities. No LLM call — pure DB lookup."""
    refs = [
        {"entity_type": r.entity_type, "entity_id": r.entity_id, "matched_sections": r.matched_sections}
        for r in body.entity_refs
    ]
    results = retrieve_content(refs)
    return {"items": results}


@router.post("/chat/refine", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat_refine(request: Request, body: RefineRequest, user: CurrentUser = Depends(get_current_user)):
    """Handle refinement round for progressive guidance."""
    refinement_text = body.selected_option or body.custom_input
    if not refinement_text.strip():
        raise HTTPException(400, "Must provide selected_option or custom_input")

    response, round_count = process_refinement(
        session_id=body.session_id,
        original_query=body.original_query,
        refinement_text=refinement_text,
        refinement_round=body.refinement_round,
        keywords=body.keywords if body.keywords else None,
        refined_query_from_option=body.refined_query,
    )

    upsert_session(body.session_id, round_count, user_id=user.user_id)
    sources_data = [s.model_dump() for s in response.sources]
    msg_id = insert_message(
        body.session_id, "assistant", response.reply,
        stage=response.stage, sources=sources_data,
    )
    response.message_id = msg_id
    return response
