import os
import sys
import shutil
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import urlparse

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.agent import run_agent
from src.ingestion import load_pdf, load_youtube_transcript, _get_vector_store
from api.schemas.learning import (
    QueryRequest,
    QueryResponse,
    IngestYouTubeRequest,
    IngestResponse,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Agentic Learning Platform API",
    description="FastAPI service connected to LangGraph agent with Guardrails, CRAG evaluation, and Document RAG.",
    version="1.0.0",
)

# Enable CORS for local/frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and UI
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", tags=["UI"])
async def root_ui():
    """Serves the main Learning App Web UI."""
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Agentic Learning API is running. UI file index.html is being initialized."}


@app.get("/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return {"status": "ok", "app": "Agentic Learning Platform"}


@app.post("/api/query", response_model=QueryResponse, tags=["Agent"])
async def ask_agent(request: QueryRequest):
    """
    Submits a query to the LangGraph Agentic Pipeline.
    Pipeline flow: Guardrails -> Retrieval -> CRAG Evaluation -> Fallback/Generate -> Checkpointed State.
    """
    user_query = request.query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    session_id = (request.session_id or "default_session").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID cannot be empty.")

    try:
        # Run agent graph in background thread pool to prevent blocking FastAPI event loop
        result = await run_in_threadpool(run_agent, user_query, session_id)

        summary = result.get("summary", "")
        # Format if summary was returned as list or objects
        if isinstance(summary, list):
            summary = "\n".join(
                [b.get("text", "") if isinstance(b, dict) else str(b) for b in summary]
            )

        return QueryResponse(
            session_id=session_id,
            query=user_query,
            summary=str(summary),
            learning_goals=result.get("learning_goals", []),
            retrieved_context=result.get("retrieved_context", []),
            evaluation_status=result.get("evaluation_status", "completed"),
            status="success",
        )
    except Exception as exc:
        logger.exception("Agent workflow execution failed.")
        raise HTTPException(
            status_code=502,
            detail="The learning agent could not generate a response. Check the server logs for details.",
        ) from exc


@app.post("/api/ingest/pdf", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_pdf_file(file: UploadFile = File(...)):
    """Uploads and ingests a PDF document into ChromaDB for agent retrieval."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files (.pdf) are supported.")

    tmp_path = None
    try:
        # Write to temporary file safely for PyPDFLoader
        suffix = Path(file.filename).suffix
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name

        docs = await run_in_threadpool(load_pdf, tmp_path)
        return IngestResponse(
            status="success",
            message=f"Successfully ingested '{file.filename}' ({len(docs)} pages) into knowledge store.",
            documents_count=len(docs),
            source=file.filename,
        )
    except Exception as exc:
        logger.exception("PDF ingestion failed.")
        raise HTTPException(
            status_code=500,
            detail="Failed to ingest the PDF. Check the server logs for details.",
        ) from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@app.post("/api/ingest/youtube", response_model=IngestResponse, tags=["Ingestion"])
async def ingest_youtube_video(request: IngestYouTubeRequest):
    """Ingests YouTube video captions/transcripts into ChromaDB for agent retrieval."""
    video_url = request.video_url.strip()
    parsed_url = urlparse(video_url)
    hostname = (parsed_url.hostname or "").lower()
    if parsed_url.scheme not in {"http", "https"} or hostname not in {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
    }:
        raise HTTPException(status_code=400, detail="Please provide a valid YouTube URL.")

    try:
        docs = await run_in_threadpool(load_youtube_transcript, video_url)
        return IngestResponse(
            status="success",
            message=f"Successfully ingested YouTube transcript chunks ({len(docs)} chunks).",
            documents_count=len(docs),
            source=video_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("YouTube transcript ingestion failed.")
        raise HTTPException(
            status_code=500,
            detail="Failed to ingest the YouTube transcript. Check the server logs for details.",
        ) from exc


@app.get("/api/store/status", tags=["Ingestion"])
async def get_store_status():
    """Returns vector store status and document counts."""
    try:
        store = _get_vector_store()
        count = store._collection.count()
        return {"status": "ready", "total_indexed_documents": count}
    except Exception as exc:
        logger.exception("Unable to read vector store status.")
        raise HTTPException(
            status_code=503,
            detail="The document store is unavailable. Check the server logs for details.",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
