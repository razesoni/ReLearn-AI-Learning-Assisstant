import json
import sys
import warnings
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

warnings.filterwarnings("ignore")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.metrics import (
    _faithfulness,
    _answer_relevancy,
    _context_precision,
    _context_recall,
)

from src.agent import run_agent
from src.ingestion import _get_embeddings
from src.nodes import get_generator_llm


BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "eval_data" / "eval_dataset.json"
RESULTS_DIR = BASE_DIR / "results"
ROOT_RESULTS_DIR = PROJECT_ROOT / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
ROOT_RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def load_evaluation_dataset():
    with open(DATASET_PATH, "r", encoding="utf-8") as file:
        test_cases = json.load(file)

    if not isinstance(test_cases, list):
        raise ValueError(f"Expected a list of test cases in {DATASET_PATH}.")
    for index, case in enumerate(test_cases, start=1):
        if not isinstance(case, dict) or not case.get("question") or not case.get("ground_truth"):
            raise ValueError(
                f"Test case {index} must contain a question and ground_truth."
            )
    return test_cases


def _as_text(value):
    if isinstance(value, list):
        return "\n".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in value
        )
    return str(value) if value is not None else ""


def generate_predictions(test_cases):
    """
    Run every question through Agentic RAG pipeline.
    """
    evaluation_data = []

    for index, case in enumerate(test_cases, start=1):
        question = case["question"]

        print(f"\n[Agent Inference {index}/{len(test_cases)}]")
        print(f"Question: {question}")

        result = run_agent(
            query=question,
            session_id=f"ragas_eval_{uuid4().hex}",
        )

        contexts = result.get("retrieved_context", [])
        if not isinstance(contexts, list):
            contexts = [str(contexts)]

        answer_text = _as_text(result.get("summary"))
        filtered_contexts = [
            context for context in contexts if isinstance(context, str) and context.strip()
        ]
        if not filtered_contexts:
            filtered_contexts = ["No external documents retrieved."]

        evaluation_data.append({
            "question": question,
            "answer": answer_text,
            "contexts": filtered_contexts,
            "ground_truth": case["ground_truth"],
            # Ragas internal schema aliases for full compatibility
            "user_input": question,
            "response": answer_text,
            "retrieved_contexts": filtered_contexts,
            "reference": case["ground_truth"],
        })

    return evaluation_data


def run_evaluation():
    test_cases = load_evaluation_dataset()
    print(f"Loaded {len(test_cases)} evaluation test cases from {DATASET_PATH}")

    # 1. Generate actual RAG predictions.
    predictions = generate_predictions(test_cases)

    # 2. Convert predictions into a HuggingFace Dataset.
    dataset = Dataset.from_list(predictions)

    # 3. Use configured Gemini LLM.
    evaluator_llm = LangchainLLMWrapper(get_generator_llm())

    # 4. Use existing embedding model.
    evaluator_embeddings = LangchainEmbeddingsWrapper(
        _get_embeddings()
    )

    # 5. Select evaluation metrics.
    metrics = [
        _faithfulness,
        _answer_relevancy,
        _context_precision,
        _context_recall,
    ]

    print("\nStarting RAGAS evaluation across all test cases...")

    # 6. Run RAGAS.
    result = evaluate(
        dataset=dataset,
        metrics=metrics,
        llm=evaluator_llm,
        embeddings=evaluator_embeddings,
        raise_exceptions=False,
    )

    # 7. Convert results into a DataFrame.
    df = cast(Any, result).to_pandas()

    # 8. Save detailed results in results folders.
    output_path = RESULTS_DIR / "ragas_results.csv"
    root_output_path = ROOT_RESULTS_DIR / "ragas_results.csv"

    df.to_csv(output_path, index=False)
    df.to_csv(root_output_path, index=False)

    # 9. Calculate average scores.
    metric_names = [
        "faithfulness",
        "answer_relevancy",
        "context_precision",
        "context_recall",
    ]

    print("\n==================== RAGAS RESULTS ====================")
    summary_metrics = {}
    for metric in metric_names:
        if metric in df.columns:
            score = pd.to_numeric(df[metric], errors="coerce").mean()
            summary_metrics[metric] = score
            print(f"{metric}: {score:.4f}")

    # Also save summary json
    summary_path = RESULTS_DIR / "ragas_summary.json"
    root_summary_path = ROOT_RESULTS_DIR / "ragas_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_metrics, f, indent=2)
    with open(root_summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_metrics, f, indent=2)

    print(f"\nDetailed results saved to:")
    print(f" -> {output_path}")
    print(f" -> {root_output_path}")
    print(f"Summary metrics saved to:")
    print(f" -> {summary_path}")
    print(f" -> {root_summary_path}")


if __name__ == "__main__":
    run_evaluation()
