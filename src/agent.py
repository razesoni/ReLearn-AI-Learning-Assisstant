from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from src.ingestion import _get_vector_store

from config.settings import settings


SYSTEM_PROMPT = """You are an expert teaching assistant.
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
