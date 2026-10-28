import io
import subprocess
import tempfile
from pathlib import Path

from groq import Groq
from langchain_core.documents import Document

from config.settings import RAW_VIDEO_DIR, settings
from src.agent import ingest_documents


def extract_audio_from_bytes(video_bytes: bytes) -> bytes:
    """Extract mono, 16 kHz MP3 audio from uploaded video bytes."""
    if not video_bytes:
        raise ValueError("The uploaded video is empty.")

    RAW_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=RAW_VIDEO_DIR) as temp_dir:
        temp_path = Path(temp_dir)
        video_file = temp_path / "input_video"
        audio_file = temp_path / "extracted_audio.mp3"
        video_file.write_bytes(video_bytes)
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_file),
            "-vn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "64k",
            "-ac",
            str(settings.audio_channels),
            "-ar",
            str(settings.audio_sample_rate),
            str(audio_file),
        ]

        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as exc:
            detail = exc.stderr.strip() if exc.stderr else str(exc)
            raise RuntimeError(f"FFmpeg could not extract audio: {detail}") from exc

        audio_bytes = audio_file.read_bytes()
        if not audio_bytes:
            raise RuntimeError(
                "FFmpeg returned empty audio. The video may not contain an audio track."
            )
        return audio_bytes


def transcribe_audio_bytes(
    audio_bytes: bytes, model_name: str | None = None
) -> str:
    """Transcribe audio, ingest its timestamped segments, and return display text."""
    if not audio_bytes:
        raise ValueError("The audio is empty.")
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is required to transcribe uploaded videos.")

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.mp3"
    try:
        response = Groq(api_key=settings.groq_api_key).audio.transcriptions.create(
            file=("audio.mp3", audio_file),
            model=model_name or settings.groq_model,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    except Exception as exc:
        raise RuntimeError(f"Groq transcription failed: {exc}") from exc

    response_data = response.model_dump()
    segments = response_data.get("segments") or []
    documents: list[Document] = []
    transcript_lines: list[str] = []

    for segment in segments:
        text = segment.get("text", "").strip()
        if not text:
            continue
        start_time = float(segment.get("start", 0))
        end_time = float(segment.get("end", start_time))
        documents.append(
            Document(
                page_content=text,
                metadata={"start_time": start_time, "end_time": end_time},
            )
        )

    if not documents:
        raise RuntimeError("Groq returned an empty transcript.")

    ingest_documents(documents)
    return "\n".join(transcript_lines)
