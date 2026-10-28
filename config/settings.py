from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

RAW_VIDEO_DIR = DATA_DIR / "raw_videos"
AUDIO_DIR = DATA_DIR / "audio_extracted"
SUMMARY_DIR = DATA_DIR / "summaries"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
VECTOR_STORE_DIR = DATA_DIR / "vector_store"
RAW_TRANSCRIPTS = TRANSCRIPTS_DIR / "raw"
CLEANED_TRANSCRIPTS = TRANSCRIPTS_DIR / "cleaned"


class Settings(BaseSettings):
    
    # LLM Settings
    SUMMARY_PROVIDER: str = "gemini" 
    GEMINI_API_KEY: str | None = "" 
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    summary_think: bool = False
    summary_max_words: int = 6000
    summary_num_predict: int = 2048

    # groq Settings
    groq_api_key: str | None = None
    transcription_provider: str = "groq"
    groq_model: str = "whisper-large-v3"

    # Embedding Settings
    embedding_model: str = (
        "sentence-transformers/all-MiniLM-L6-v2"
    )

    # Audio
    audio_format: str = "mp3"
    audio_sample_rate: int = 16000
    audio_channels: int = 1

    # Video
    RAW_VIDEO_DIR: Path = RAW_VIDEO_DIR
    MAX_FILE_SIZE_MB: int = 200
    MAX_FILE_SIZE: int = 200
    ALLOWED_EXTENSIONS: set[str] = {".mp4", ".mpeg", ".mpv", ".mkv", ".mov", ".webm", ".avi"}
    ALLOWED_CODECS: set[str] = {"h264", "aac", "hevc", "vp9", "av1", "mp3", "opus"}
    CHUNK_SIZE_BYTES: int = 8 * 1024 * 1024

    # Environment
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
    