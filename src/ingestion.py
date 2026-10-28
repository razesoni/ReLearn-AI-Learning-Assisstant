from functools import lru_cache

from langchain_community.document_loaders import PyPDFLoader, YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from config.settings import VECTOR_STORE_DIR

COLLECTION_NAME = "rag_learning_app"

from config.settings import VECTOR_STORE_DIR, settings

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
    loader = PyPDFLoader(file_path, mode="page")
    documents = loader.load()
    for document in documents:
        document.metadata["page_number"] = document.metadata["page"] + 1
    ingest_documents(documents)
    return documents


def load_youtube_transcript(video_url: str) -> list[Document]:
    loader = YoutubeLoader(
        video_url,
        add_video_info=True,
        language="en",
        transcript_format=TranscriptFormat.CHUNKS,
        chunk_size_seconds=60,
    )
    documents = loader.load()
    for document in documents:
        document.metadata.update(
            {
                "video_url": video_url,
                "start_timestamp": document.metadata.get("start_timestamp"),
                "end_timestamp": document.metadata.get("end_timestamp"),
            }
        )
    ingest_documents(documents)
    return documents


def ingest_documents(documents: list[Document]) -> Chroma:
    if not documents:
        raise ValueError("No documents were provided for ingestion.")

    text_splitter = SemanticChunker(
        embeddings=_get_embeddings(),
        breakpoint_threshold_type="percentile",
        breakpoint_threshold_amount=95,
    )
    chunks = text_splitter.split_documents(documents)
    if not chunks:
        raise ValueError("Document ingestion produced no text chunks.")
    vector_store = _get_vector_store()
    vector_store.add_documents(chunks)
    return vector_store