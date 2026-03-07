from pydantic import BaseModel
from typing import Optional


# --- Chat ---

class ChatRequest(BaseModel):
    session_id: str
    message: str


class SourceRef(BaseModel):
    type: str  # "doc" or "ticket"
    id: str
    title: str
    relevance_score: float


class SolutionData(BaseModel):
    symptom: str
    reason: str
    solution: str
    status: str = "verified"


class ChatResponse(BaseModel):
    reply: str
    stage: int
    sources: list[SourceRef] = []
    session_id: str
    message_id: str = ""
    solution_data: Optional[SolutionData] = None
    content_items: Optional[list[dict]] = None
    refinement_options: Optional[list['RefinementOption']] = None
    refinement_context: Optional['RefinementContext'] = None
    near_miss_results: Optional[list['NearMissResult']] = None
    token_usage: Optional[dict] = None
    response_time_ms: Optional[int] = None


class EntityRef(BaseModel):
    entity_type: str   # 'doc' | 'ticket'
    entity_id: str
    title: str = ""
    confidence: float = 0.0
    matched_sections: list[str] = []  # section_titles matched by fingerprint query


class ContentResult(BaseModel):
    entity_type: str
    entity_id: str
    title: str
    content: str = ""
    section_title: str = ""
    ticket_number: str = ""
    phenomenon: str = ""
    cause: str = ""
    solution: str = ""
    matched_sections: list[str] = []  # fingerprint-matched section titles for highlighting


class RetrieveRequest(BaseModel):
    session_id: str
    entity_refs: list[EntityRef]


# --- Refinement (Progressive Guidance) ---

class RefinementOption(BaseModel):
    id: str
    label: str
    description: str = ""
    keywords: list[str] = []
    refined_query: str = ""


class NearMissResult(BaseModel):
    entity_type: str
    entity_id: str
    title: str = ""
    confidence: float = 0.0
    snippet: str = ""


class RefinementContext(BaseModel):
    original_query: str
    current_query: str
    refinement_round: int
    max_rounds: int = 3
    near_miss_matches: list[NearMissResult] = []


class RefineRequest(BaseModel):
    session_id: str
    original_query: str
    selected_option: str = ""
    custom_input: str = ""
    refinement_round: int
    keywords: list[str] = []
    refined_query: str = ""


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


# --- Batch Operations ---

class BatchRequest(BaseModel):
    action: str
    ids: list[str]


# --- Document Update ---

class DocUpdateRequest(BaseModel):
    cleaned_content: Optional[str] = None
    title: Optional[str] = None
    category: Optional[str] = None


# --- Ticket Update ---

class TicketUpdateRequest(BaseModel):
    phenomenon: Optional[str] = None
    cause: Optional[str] = None
    solution: Optional[str] = None


# --- Settings ---

class SettingsUpdateRequest(BaseModel):
    model_config = {"extra": "allow"}


# --- Feedback ---

class FeedbackRequest(BaseModel):
    message_id: str
    rating: int  # 1 or -1


class FeedbackTicketRequest(BaseModel):
    session_id: str
    message_id: str
    comment: str = ""


# --- Versions ---

class RollbackRequest(BaseModel):
    version_id: str
