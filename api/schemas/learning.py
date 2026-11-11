from pydantic import BaseModel, Field
from typing import List, Optional


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000, description="User question or topic to study")
    session_id: Optional[str] = Field(default="default_session", description="Thread/Session ID for conversation persistence")


class QueryResponse(BaseModel):
    session_id: str
    query: str
    summary: str
    learning_goals: List[str] = Field(default_factory=list)
    retrieved_context: List[str] = Field(default_factory=list)
    evaluation_status: str = "sufficient"
    status: str = "success"


class IngestYouTubeRequest(BaseModel):
    video_url: str = Field(..., description="YouTube video URL with available transcripts/captions")


class IngestResponse(BaseModel):
    status: str
    message: str
    documents_count: int
    source: str
