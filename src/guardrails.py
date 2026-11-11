from typing import List, Literal, Annotated
from typing_extensions import TypedDict
from operator import add
from langchain_core.messages import BaseMessage
from langchain_core.output_parsers import PydanticOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

from config.settings import settings


class LearningGraphState(TypedDict):
    session_id: str
    user_query: str
    retrieved_context: List[str]
    evaluation_status: str
    summary: str
    learning_goals: List[str]
    messages: Annotated[List[BaseMessage], add]


class GuardrailOutput(BaseModel):
    """Structured assessment returned by guardrail evaluator."""
    is_safe: bool = Field(
        description="False if query contains explicit content, self-harm, hate speech, or malicious intent."
    )
    is_grounded_in_documents: bool = Field(
        description="True if the question relates to general learning, academics, coursework, or study topics."
    )
    reasoning: str = Field(
        default="",
        description="Brief explanation of safety or relevance classification."
    )


guardrail_parser = PydanticOutputParser(pydantic_object=GuardrailOutput)


def get_guardrail_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else None,
        temperature=0.0,
    )


def evaluate_guardrails(query: str) -> GuardrailOutput:
    """Evaluates query safety and educational topic relevance."""
    # Fast heuristic check for obvious safe queries or when API key is unavailable
    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        return GuardrailOutput(is_safe=True, is_grounded_in_documents=True, reasoning="Bypass: No API key set")

    prompt = f"""Analyze the user query for an educational AI learning platform.
User Query: "{query}"

Rules:
1. Set `is_safe` to False if the query contains explicit, violent, adult, abusive, self-harm, or malicious content.
2. Set `is_grounded_in_documents` to False if the query has nothing to do with studying, education, academics, concepts, coding, research, or learning.
3. Otherwise, set both to True.

{guardrail_parser.get_format_instructions()}
"""
    try:
        llm = get_guardrail_llm()
        response = llm.invoke(prompt)
        raw_content = response.content if hasattr(response, "content") else str(response)
        if isinstance(raw_content, str):
            content = raw_content
        elif isinstance(raw_content, list):
            content = "".join(
                part if isinstance(part, str) else str(part.get("text", ""))
                for part in raw_content
                if isinstance(part, (str, dict))
            )
        else:
            content = str(raw_content)
        return guardrail_parser.parse(content)
    except Exception as exc:
        # Fallback safely without blocking legitimate users on parse errors
        return GuardrailOutput(
            is_safe=True,
            is_grounded_in_documents=True,
            reasoning=f"Evaluated with fallback: {exc}"
        )


def check_query_guardrails(state: LearningGraphState) -> dict:
    """Guardrail graph node: verifies safety and educational relevance."""
    query = state.get("user_query", "").strip()
    if not query:
        return {"summary": "Please enter a valid study question."}

    assessment = evaluate_guardrails(query)

    if not assessment.is_safe:
        return {
            "summary": "Blocked by safety filters: Your query contains inappropriate or explicit content.",
            "learning_goals": []
        }
    elif not assessment.is_grounded_in_documents:
        return {
            "summary": "Out-of-Scope: I am your Socratic AI Tutor focused on study materials, academics, and learning concepts.",
            "learning_goals": []
        }

    return {}


def route_after_guardrail(state: LearningGraphState) -> Literal["retrieve", "end_flow"]:
    """Determines whether to proceed with retrieval or terminate early."""
    summary = state.get("summary", "")
    if summary and ("Blocked by safety filters" in summary or "Out-of-Scope" in summary or "Please enter" in summary):
        return "end_flow"
    return "retrieve"

