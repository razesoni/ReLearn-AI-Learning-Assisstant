import sys
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import settings
from src.video_ingestion import extract_audio_from_bytes, transcribe_audio_bytes
from src.agent import rag_chat

app = FastAPI(title="Margin Learning API")
app.mount("/static", StaticFiles(directory=PROJECT_ROOT / "frontend"), name="static")
templates = Jinja2Templates(directory=str(PROJECT_ROOT / "frontend" / "template"))


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)


@app.get("/")
async def root():
    return {"message": "Welcome to the Margin Learning API!"}

@app.get("/health", include_in_schema=False)
async def health_check():
    return {"status": "ok"}

@app.get("/new", include_in_schema=False)
async def new_video_page(request: Request):
    return templates.TemplateResponse(request, "new.html")

@app.post("/upload-video/")
async def upload_and_transcribe(file: UploadFile = File(...)):
    if (
        not file.filename
        or Path(file.filename).suffix.lower() not in settings.ALLOWED_EXTENSIONS
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload a supported video file.",
        )
    max_file_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if file.size is not None and file.size > max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"The uploaded video exceeds the {settings.MAX_FILE_SIZE_MB} MB limit.",
        )
    try:
        video_bytes = await file.read()

        if not video_bytes:
            raise HTTPException(status_code=400, detail="The uploaded video is empty.")
        if len(video_bytes) > max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"The uploaded video exceeds the {settings.MAX_FILE_SIZE_MB} MB limit.",
            )
        audio_bytes = await run_in_threadpool(extract_audio_from_bytes, video_bytes)
        transcript = await run_in_threadpool(transcribe_audio_bytes, audio_bytes)

        return {
            "filename": file.filename,
            "transcript": transcript,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        await file.close()


@app.post("/chat/")
async def chat(request: ChatRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="The query cannot be empty.")
    try:
        answer = await run_in_threadpool(rag_chat, query)
        return {"answer": answer}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
