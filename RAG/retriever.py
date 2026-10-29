"""
Retrievers for RAG.
Includes Dense Vector Retrievers, Sparse Keyword (BM25) Retrievers,
and Hybrid Search with Reciprocal Rank Fusion (RRF).
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import math
from collections import Counter
from RAG.loader import Document
from RAG.vector_store import BaseVectorStore, VectorSearchResult


class BaseRetriever(ABC):
    """Abstract interface for all context retrievers."""

    @abstractmethod
    def retrieve(self, query: str, top_k: int = 5) -> List[VectorSearchResult]:
        """Retrieves top_k most relevant documents for the query."""
        pass


class DenseRetriever(BaseRetriever):
    """Retrieves documents using dense vector embeddings in a vector store."""

    def __init__(self, vector_store: BaseVectorStore, score_threshold: float = 0.0):
        self.vector_store = vector_store
        self.score_threshold = score_threshold

    def retrieve(self, query: str, top_k: int = 5) -> List[VectorSearchResult]:
        return self.vector_store.similarity_search(
            query=query,
            top_k=top_k,
            score_threshold=self.score_threshold
        )


class SparseBM25Retriever(BaseRetriever):
    """
    In-memory BM25 (Best Matching 25) sparse keyword retriever.
    Particularly effective for exact symbol, class, and method name lookup.
    """

    def __init__(self, documents: List[Document], k1: float = 1.5, b: float = 0.75):
        self.documents = documents
        self.k1 = k1
        self.b = b
        self.corpus_size = len(documents)
        self.avg_doc_len = 0.0
        self.doc_lens: List[int] = []
        self.doc_freqs: Dict[str, int] = Counter()
        self.term_freqs: List[Dict[str, int]] = []
        self._index_corpus()

    def _tokenize(self, text: str) -> List[str]:
        return text.lower().replace("_", " ").split()

    def _index_corpus(self):
        total_len = 0
        for doc in self.documents:
            tokens = self._tokenize(doc.content)
            doc_len = len(tokens)
            self.doc_lens.append(doc_len)
            total_len += doc_len

            tf = Counter(tokens)
            self.term_freqs.append(tf)
            for token in tf:
                self.doc_freqs[token] += 1

        self.avg_doc_len = total_len / max(1, self.corpus_size)

    def retrieve(self, query: str, top_k: int = 5) -> List[VectorSearchResult]:
        query_tokens = self._tokenize(query)
        scores: List[float] = [0.0] * self.corpus_size

        for token in query_tokens:
            df = self.doc_freqs.get(token, 0)
            if df == 0:
                continue
            # Standard Robertson-Spärck Jones IDF
            idf = math.log((self.corpus_size - df + 0.5) / (df + 0.5) + 1.0)
            for doc_idx in range(self.corpus_size):
                tf = self.term_freqs[doc_idx].get(token, 0)
                if tf == 0:
                    continue
                doc_len = self.doc_lens[doc_idx]
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / max(1.0, self.avg_doc_len)))
                scores[doc_idx] += idf * (numerator / denominator)

        results = [
            VectorSearchResult(document=self.documents[i], score=scores[i])
            for i in range(self.corpus_size)
            if scores[i] > 0.0
        ]
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]


class HybridRetriever(BaseRetriever):
    """
    Combines dense semantic vector search with sparse BM25 keyword matching
    using Reciprocal Rank Fusion (RRF) for optimal recall and precision.
    """

    def __init__(
        self,
        dense_retriever: DenseRetriever,
        sparse_retriever: SparseBM25Retriever,
        rrf_k: int = 60,
        dense_weight: float = 0.7,
        sparse_weight: float = 0.3
    ):
        self.dense_retriever = dense_retriever
        self.sparse_retriever = sparse_retriever
        self.rrf_k = rrf_k
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight

    def retrieve(self, query: str, top_k: int = 5) -> List[VectorSearchResult]:
        dense_results = self.dense_retriever.retrieve(query, top_k=top_k * 2)
        sparse_results = self.sparse_retriever.retrieve(query, top_k=top_k * 2)

        rrf_scores: Dict[str, float] = {}
        doc_map: Dict[str, Document] = {}

        # Rank-based fusion
        for rank, res in enumerate(dense_results):
            doc_id = res.document.doc_id
            doc_map[doc_id] = res.document
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + self.dense_weight / (self.rrf_k + rank + 1)

        for rank, res in enumerate(sparse_results):
            doc_id = res.document.doc_id
            doc_map[doc_id] = res.document
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + self.sparse_weight / (self.rrf_k + rank + 1)

        sorted_ids = sorted(rrf_scores.keys(), key=lambda k: rrf_scores[k], reverse=True)
        return [
            VectorSearchResult(document=doc_map[doc_id], score=rrf_scores[doc_id])
            for doc_id in sorted_ids[:top_k]
        ]
