"""
Vector Database and Storage Abstraction for RAG.
Manages indexing, storage, persistence, and k-nearest neighbors search
over embedded Document objects.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import json
from pathlib import Path
from RAG.loader import Document
from RAG.embeddings import BaseEmbeddingModel, cosine_similarity


@dataclass
class VectorSearchResult:
    """Represents a matched document with its similarity score."""
    document: Document
    score: float


class BaseVectorStore(ABC):
    """Abstract interface for vector database storage."""

    @abstractmethod
    def add_documents(self, documents: List[Document]) -> List[str]:
        """Adds documents to the vector store and returns their IDs."""
        pass

    @abstractmethod
    def similarity_search(self, query: str, top_k: int = 5, score_threshold: float = 0.0) -> List[VectorSearchResult]:
        """Performs k-NN similarity search given a query string."""
        pass


class InMemoryVectorStore(BaseVectorStore):
    """
    Lightweight, production-grade in-memory vector database with
    cosine similarity search, metadata filtering, and serialization.
    """

    def __init__(self, embedding_model: BaseEmbeddingModel):
        self.embedding_model = embedding_model
        self.documents: List[Document] = []
        self.vectors: List[List[float]] = []

    def add_documents(self, documents: List[Document]) -> List[str]:
        if not documents:
            return []
        texts = [doc.content for doc in documents]
        new_vectors = self.embedding_model.embed_documents(texts)
        self.documents.extend(documents)
        self.vectors.extend(new_vectors)
        return [doc.doc_id for doc in documents]

    def similarity_search(
        self,
        query: str,
        top_k: int = 5,
        score_threshold: float = 0.0,
        filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[VectorSearchResult]:
        if not self.documents:
            return []

        query_vector = self.embedding_model.embed_query(query)
        scored_results: List[VectorSearchResult] = []

        for doc, doc_vec in zip(self.documents, self.vectors):
            # Apply metadata filters if provided
            if filter_dict:
                match = all(doc.metadata.get(k) == v for k, v in filter_dict.items())
                if not match:
                    continue

            score = cosine_similarity(query_vector, doc_vec)
            if score >= score_threshold:
                scored_results.append(VectorSearchResult(document=doc, score=score))

        # Sort descending by similarity score
        scored_results.sort(key=lambda x: x.score, reverse=True)
        return scored_results[:top_k]

    def save_to_file(self, file_path: str) -> None:
        """Serializes documents and vectors to a JSON file."""
        data = {
            "documents": [
                {"content": d.content, "metadata": d.metadata, "doc_id": d.doc_id}
                for d in self.documents
            ],
            "vectors": self.vectors
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    def load_from_file(self, file_path: str) -> None:
        """Loads serialized documents and vectors from a JSON file."""
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.documents = [
            Document(content=d["content"], metadata=d["metadata"], doc_id=d["doc_id"])
            for d in data["documents"]
        ]
        self.vectors = data["vectors"]
