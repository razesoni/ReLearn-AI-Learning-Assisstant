import logging
from functools import lru_cache
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader, YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from config.settings import VECTOR_STORE_DIR, settings

COLLECTION_NAME = "rag_learning_app"
PROJECT_COLLECTION_NAME = "rag_learning_app_project"
logger = logging.getLogger(__name__)


class DocumentIngestionError(RuntimeError):
    """Raised when a source cannot be loaded or stored for retrieval."""


@lru_cache(maxsize=1)
def _get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=settings.embedding_model)


def _get_vector_store() -> Chroma:
    VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
    return Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=_get_embeddings(),
        persist_directory=str(VECTOR_STORE_DIR),
    )


def load_pdf(file_path: str) -> list[Document]:
    pdf_path = Path(file_path)
    if not pdf_path.is_file():
        raise FileNotFoundError(f"PDF file does not exist: {file_path}")

    try:
        documents = PyPDFLoader(str(pdf_path), mode="page").load()
    except Exception as exc:
        logger.exception("Failed to load PDF: %s", pdf_path.name)
        raise DocumentIngestionError("Failed to read the uploaded PDF.") from exc

    if not documents:
        raise ValueError("The PDF contains no readable pages.")

    for document in documents:
        page = document.metadata.get("page")
        if isinstance(page, int):
            document.metadata["page_number"] = page + 1
        document.metadata["source"] = "pdf"

    ingest_documents(documents)
    return documents


def load_youtube_transcript(video_url: str) -> list[Document]:
    if not video_url.strip():
        raise ValueError("A YouTube URL is required.")

    try:
        loader = YoutubeLoader.from_youtube_url(
            video_url,
            add_video_info=False,
            language="en",
            transcript_format=TranscriptFormat.CHUNKS,
            chunk_size_seconds=60,
        )
    except ValueError as exc:
        raise ValueError("Please provide a valid YouTube video URL.") from exc
    except Exception as exc:
        logger.exception("Failed to prepare the YouTube transcript loader.")
        raise DocumentIngestionError(
            "Could not prepare the transcript loader for this YouTube video."
        ) from exc

    try:
        documents = loader.load()
    except Exception as exc:
        logger.exception("Failed to load YouTube transcript.")
        raise DocumentIngestionError(
            "Could not load a transcript for this YouTube video."
        ) from exc

    if not documents:
        raise ValueError("No transcript was available for this YouTube video.")

    for document in documents:
        document.metadata.update(
            {
                "video_url": video_url,
                "start_timestamp": document.metadata.get("start_timestamp"),
                "end_timestamp": document.metadata.get("end_timestamp"),
                "source": "youtube_url",
            }
        )

    ingest_documents(documents)
    return documents


def ingest_documents(documents: list[Document]) -> Chroma:
    if not documents:
        raise ValueError("No documents were provided for ingestion.")

    readable_documents = [document for document in documents if document.page_content.strip()]
    if not readable_documents:
        raise ValueError("The provided documents contain no readable text.")

    try:
        text_splitter = SemanticChunker(
            embeddings=_get_embeddings(),
            breakpoint_threshold_type="percentile",
            breakpoint_threshold_amount=95,
        )
        chunks = text_splitter.split_documents(readable_documents)
    except Exception as exc:
        logger.exception("Failed to split documents into semantic chunks.")
        raise DocumentIngestionError("Failed to process document text.") from exc

    if not chunks:
        raise ValueError("Document ingestion produced no text chunks.")

    try:
        vector_store = _get_vector_store()
        vector_store.add_documents(chunks)
    except Exception as exc:
        logger.exception("Failed to write document chunks to the vector store.")
        raise DocumentIngestionError("Failed to save document chunks.") from exc

    return vector_store