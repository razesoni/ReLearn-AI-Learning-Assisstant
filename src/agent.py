import sqlite3
import logging
from typing import Any

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver
from langchain_core.runnables import RunnableConfig

from config.settings import BASE_DIR
from src.guardrails import (
    LearningGraphState,
    check_query_guardrails,
    route_after_guardrail,
)
from src.nodes import (
    out_of_bounds_node,
    retrieval_node,
    crag_evaluator_node,
    route_after_evaluation,
    web_search_node,
    generator_node,
)

logger = logging.getLogger(__name__)

builder = StateGraph(LearningGraphState)

builder.add_node("guardrail", check_query_guardrails)
builder.add_node("retrieve", retrieval_node)
builder.add_node("evaluate", crag_evaluator_node)
builder.add_node("out_of_bounds_node", out_of_bounds_node)
builder.add_node("web_search", web_search_node)
builder.add_node("generate", generator_node)

builder.add_edge(START, "guardrail")
builder.add_conditional_edges(
    "guardrail",
    route_after_guardrail,
    {
        "retrieve": "retrieve",
        "end_flow": END,
    },
)
builder.add_edge("retrieve", "evaluate")
builder.add_conditional_edges(
    "evaluate",
    route_after_evaluation,
    {
        "out_of_bounds_node": "out_of_bounds_node",
        "web_search_node": "web_search",
        "generator_node": "generate",
    },
)
builder.add_edge("out_of_bounds_node", END)
builder.add_edge("web_search", "generate")
builder.add_edge("generate", END)

DB_PATH = BASE_DIR / "learning_platform_state.db"
_sqlite_conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
memory = SqliteSaver(_sqlite_conn)
memory.setup()

agent_graph = builder.compile(checkpointer=memory)


def run_agent(query: str, session_id: str = "default_session") -> dict[str, Any]:
    """
    Executes the compiled LangGraph workflow with session checkpointing.
    Returns the final state containing summary, learning_goals, and retrieved context.
    """
    normalized_query = query.strip()
    normalized_session_id = session_id.strip()
    if not normalized_query:
        raise ValueError("The study query cannot be empty.")
    if not normalized_session_id:
        raise ValueError("The session ID cannot be empty.")

    initial_state: LearningGraphState = {
        "session_id": normalized_session_id,
        "user_query": normalized_query,
        "retrieved_context": [],
        "evaluation_status": "pending",
        "summary": "",
        "learning_goals": [],
        "messages": [],
    }

    config: RunnableConfig = {"configurable": {"thread_id": normalized_session_id}}
    try:
        return agent_graph.invoke(initial_state, config=config)
    except Exception:
        logger.exception("Agent workflow failed for session %s.", normalized_session_id)
        raise
