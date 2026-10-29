"""
Evaluation Metrics for Retrieval-Augmented Generation (RAG).
Calculates context relevance, ground truth faithfulness, and answer precision.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Set
import re


@dataclass
class EvaluationMetrics:
    """Metrics assessing retrieval quality and generation fidelity."""
    context_precision: float
    context_recall: float
    groundedness_score: float
    is_faithful: bool


class RAGEvaluator:
    """
    Evaluates RAG pipeline outputs against retrieved context and reference ground truth.
    """

    @staticmethod
    def _extract_keywords(text: str) -> Set[str]:
        words = re.findall(r"\b[A-Za-z0-9_]{3,}\b", text.lower())
        stopwords = {"the", "and", "for", "with", "that", "this", "from", "are", "which"}
        return {w for w in words if w not in stopwords}

    def evaluate_response(
        self,
        query: str,
        answer: str,
        retrieved_contexts: List[str],
        ground_truth: str = ""
    ) -> EvaluationMetrics:
        """
        Computes precision, recall, and groundedness for an answer given its context.
        """
        combined_context = " ".join(retrieved_contexts)
        context_words = self._extract_keywords(combined_context)
        answer_words = self._extract_keywords(answer)
        query_words = self._extract_keywords(query)
        ground_truth_words = self._extract_keywords(ground_truth) if ground_truth else set()

        # Context Precision: Proportion of query concepts matched in context
        if query_words:
            matched_query_in_context = query_words.intersection(context_words)
            context_precision = len(matched_query_in_context) / len(query_words)
        else:
            context_precision = 1.0

        # Groundedness / Faithfulness: Proportion of non-trivial answer terms rooted in context
        if answer_words:
            grounded_terms = answer_words.intersection(context_words)
            groundedness = len(grounded_terms) / len(answer_words)
        else:
            groundedness = 1.0

        # Context Recall: Coverage against known ground truth (if provided)
        if ground_truth_words:
            recalled_terms = ground_truth_words.intersection(context_words)
            context_recall = len(recalled_terms) / len(ground_truth_words)
        else:
            context_recall = 1.0

        is_faithful = groundedness >= 0.5 and context_precision >= 0.3

        return EvaluationMetrics(
            context_precision=round(context_precision, 4),
            context_recall=round(context_recall, 4),
            groundedness_score=round(groundedness, 4),
            is_faithful=is_faithful
        )
