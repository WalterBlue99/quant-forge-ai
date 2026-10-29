"""
Embedding Models and Vector Representations for RAG.
Converts text chunks into dense floating-point vector representations.
"""

from abc import ABC, abstractmethod
from typing import List
import math
import hashlib


class BaseEmbeddingModel(ABC):
    """Abstract interface for text embedding models."""

    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embeds a list of document strings into vector representations."""
        pass

    @abstractmethod
    def embed_query(self, text: str) -> List[float]:
        """Embeds a single query string into a vector representation."""
        pass


def l2_normalize(vector: List[float]) -> List[float]:
    """Normalizes a vector to unit length (L2 norm)."""
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0.0:
        return vector
    return [x / norm for x in vector]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes cosine similarity between two numeric vectors."""
    if len(v1) != len(v2):
        raise ValueError(f"Vector dimension mismatch: {len(v1)} vs {len(v2)}")
    dot = sum(a * b for a, b in zip(v1, v2))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class DeterministicFeatureEmbeddingModel(BaseEmbeddingModel):
    """
    High-performance zero-dependency deterministic hashing embedding model.
    Generates consistent dense vectors for any text without external API calls,
    ideal for self-contained or offline unit testing and edge RAG bootstrapping.
    """

    def __init__(self, dimension: int = 256):
        self.dimension = dimension

    def _hash_to_vector(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        words = text.lower().split()
        for word in words:
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            sign = 1.0 if (h >> 8) % 2 == 0 else -1.0
            vec[idx] += sign
        return l2_normalize(vec)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._hash_to_vector(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._hash_to_vector(text)
