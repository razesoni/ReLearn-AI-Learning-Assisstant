import logging
from typing import Literal
import numpy as np
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from sklearn.metrics.pairwise import cosine_similarity
from langchain_huggingface import HuggingFaceEmbeddings

from config.settings import settings
from src.guardrails import LearningGraphState
from src.ingestion import _get_vector_store
from src.tools import web_search

logger = logging.getLogger(__name__)


def get_generator_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else None,
        # temperature=0.3,
    )


def retrieval_node(state: LearningGraphState) -> dict:
    """Retrieves top relevant chunks from ChromaDB for the user query."""
    query = state.get("user_query", "")
    try:
        store = _get_project_vector_store()
        results = store.similarity_search(query, k=3)
        context = [doc.page_content for doc in results if doc.page_content]
    except Exception:
        logger.exception("Vector retrieval failed; continuing to fallback search.")
        context = []
    return {"retrieved_context": context}


def crag_evaluator_node(state: LearningGraphState) -> dict:
    """
    Evaluates context relevance using cosine similarity across 3 thresholds:
    - < 0.4: out_of_bounds
    - 0.4 - 0.7: needs_search
    - > 0.7: sufficient
    """
    context = state.get("retrieved_context", [])
    query = state.get("user_query", "")

    if not context or len(context) == 0:
        return {"evaluation_status": "out_of_bounds"}

    embeddings_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    query_embedding = embeddings_model.embed_query(query)
    context_embeddings = embeddings_model.embed_documents(context)

    similarity_scores = cosine_similarity(
        np.asarray([query_embedding]), np.asarray(context_embeddings)
    )[0]

    max_similarity = np.max(similarity_scores) if similarity_scores.size > 0 else 0.0

    if max_similarity < 0.4:
        status = "out_of_bounds"
    elif 0.4 <= max_similarity < 0.7:
        status = "needs_search"
    else:
        status = "sufficient"
    return {"evaluation_status": status}


def out_of_bounds_node(state: LearningGraphState) -> dict:
    """
    Fallback node when similarity is below 0.4. Sets strict refusal message.
    """
    return {
        "summary": "Please ask questions relevant to data present in the vectordb.",
        "learning_goals": []
    }


def route_after_evaluation(state: LearningGraphState) -> Literal["out_of_bounds_node", "web_search_node", "generator_node"]:
    """
    Routes execution based on the 3 evaluation status tiers.
    """
    status = state.get("evaluation_status")
    
    if status == "out_of_bounds":
        return "out_of_bounds_node"
    elif status == "needs_search":
        return "web_search_node"
    else:
        return "generator_node"


def web_search_node(state: LearningGraphState) -> dict:
    """Fallback node: queries web search when vector store lacks sufficient context."""
    query = state.get("user_query", "")
    try:
        search_res = web_search.invoke({"query": query, "max_results": 3})
        existing = state.get("retrieved_context", [])
        combined = list(existing) + [f"Web Reference Context:\n{search_res}"]
        return {"retrieved_context": combined}
    except Exception:
        logger.exception("Web fallback search failed.")
        return {"retrieved_context": state.get("retrieved_context", [])}


def generator_node(state: LearningGraphState) -> dict:
    """Synthesizes context into an educational summary with actionable learning goals."""
    context = state.get("retrieved_context", [])
    query = state.get("user_query", "")
    context_str = "\n\n---\n\n".join(context) if context else "No additional context found."

    prompt = f"""You are a skilled Socratic AI Tutor helping a student learn effectively.

Student Question:
{query}

Context from Knowledge Base / Course Materials:
{context_str}

Please generate:
1. A clear, pedagogical explanation and summary directly answering the student's question.
2. Exactly 3 crisp, actionable learning milestones/goals for the student to master next.

Structure your response with clear Markdown headings:
## Explanation & Summary
<detailed response>

## Recommended Learning Goals
- Goal 1: ...
- Goal 2: ...
- Goal 3: ...
"""
    try:
        llm = get_generator_llm()
        resp = llm.invoke([
            SystemMessage(content="You are an expert interactive AI learning mentor."),
            HumanMessage(content=prompt)
        ])
        content = resp.content if hasattr(resp, "content") else str(resp)
        if isinstance(content, list):
            content = "".join([block.get("text", "") if isinstance(block, dict) else str(block) for block in content])
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("The summary model returned an empty response.")

        goals = [
            "Master core foundational principles and definitions",
            "Examine practical examples and system trade-offs",
            "Synthesize and apply concepts through hands-on practice",
        ]
        return {
            "summary": content,
            "learning_goals": goals,
            "messages": [HumanMessage(content=query), resp],
        }
    except Exception:
        logger.exception("Summary generation failed.")
        raise
