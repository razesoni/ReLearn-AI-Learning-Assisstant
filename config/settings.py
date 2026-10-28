from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

VECTOR_STORE_DIR = BASE_DIR / "vector_store"


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

    # Environment
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
    