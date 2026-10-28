from pydantic import BaseModel
from typing import Any

class VideoUploadResponse(BaseModel):
    video_id: str
    filename: str
    saved_path: str
    duration_seconds: float
    video_codec: str | None
    audio_codec: str | None
    file_size_mb: float
    message: str
    ingestion_result: dict


class IngestionJobResponse(BaseModel):
    job_id: str
    status: str
    message: str


class IngestionStatusResponse(BaseModel):
    job_id: str
    status: str
    current_stage: str | None = None
    stages: dict[str, str]
    message: str | None = None
    result: dict[str, Any] | None = None