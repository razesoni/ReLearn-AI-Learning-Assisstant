from functools import lru_cache

from langchain_community.document_loaders import PyPDFLoader, YoutubeLoader
from langchain_community.document_loaders.youtube import TranscriptFormat
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_experimental.text_splitter import SemanticChunker
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings

from config.settings import VECTOR_STORE_DIR, settings

COLLECTION_NAME = "rag_learning_app"


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


SYSTEM_PROMPT = """You are a helpful assistant.
Use the following information to answer the question:
- {context}

If the answer is not in the context, say "I don't know".
Answer in the same language as the question.
Keep the answer concise and to the point.
If the question is a greeting, respond politely."""

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("user", "{question}"),
    ]
)


def create_agent():
    llm = ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY or None,
    )
    return llm


def rag_chat(query: str) -> str:
    if not query.strip():
        raise ValueError("The question cannot be empty.")

    documents = _get_vector_store().similarity_search(query, k=5)
    context = "\n\n".join(document.page_content for document in documents)
    response = (prompt | create_agent()).invoke(
        {"context": context or "No relevant documents have been uploaded.", "question": query}
    )
    return response.content if isinstance(response.content, str) else str(response.content)


if __name__ == "__main__":
    print(rag_chat("Tell me about yourself"))
