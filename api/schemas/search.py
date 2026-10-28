"""Pydantic schemas for search API requests and responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Payload schema for client search requests."""
    query: str = Field(..., min_length=1, max_length=500, description="Natural language search query")
    top_k: int = Field(default=4, ge=1, le=50, description="Maximum number of search results to return")
    scope: str = Field(default="both", description="Search target scope: 'transcript', 'summary', or 'both'")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Optional metadata key-value filter conditions")


class SearchResult(BaseModel):
    """Schema representing an enriched search hit snippet."""
    video_id: str = Field(..., description="Canonical video asset stem identifier")
    video_title: str = Field(..., description="Display title of the video asset")
    season: str = Field(default="Season 1", description="Season designation label")
    episode: str = Field(default="Episode", description="Episode designation label")
    start_seconds: float = Field(..., description="Start timestamp in floating seconds")
    end_seconds: float = Field(..., description="End timestamp in floating seconds")
    timestamp_label: str = Field(..., description="Human-readable timestamp display label (e.g. '08:17 - 08:35')")
    matched_text: str = Field(..., description="Extracted transcript segment or summary text snippet")
    confidence_score: float = Field(..., description="Raw relevance score percentage (0-100)")
    semantic_match_percent: int = Field(..., description="Rounded match percentage for UI badge display")
    source: str = Field(..., description="Source origin ('transcript' or 'summary')")
    media_url: str = Field(..., description="HTTP stream URL path for the video asset")
    watch_url: str = Field(..., description="Direct frontend watch deep link with timestamp parameter")


class SearchResponse(BaseModel):
    """Payload schema returned to client upon successful search completion."""
    query: str = Field(..., description="Cleaned and processed query text string")
    total_results: int = Field(..., description="Total count of matching result items returned")
    execution_time_ms: float = Field(..., description="Pipeline execution duration in milliseconds")
    results: List[SearchResult] = Field(default_factory=list, description="List of enriched search result hits")
