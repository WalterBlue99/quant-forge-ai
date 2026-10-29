"""
RAG (Retrieval-Augmented Generation) Standard Framework.
Provides modular components for Document Loading, Text Chunking,
Embeddings, Vector Database Storage, Hybrid Retrieval, and LLM Synthesis.
"""

from RAG.config import (
    RAGConfig,
    ChunkingConfig,
    EmbeddingConfig,
    VectorStoreConfig,
    RetrieverConfig,
    GeneratorConfig,
)
from RAG.loader import (
    Document,
    BaseLoader,
    TextLoader,
    SourceCodeLoader,
    DirectoryLoader,
)
from RAG.chunker import (
    BaseChunker,
    RecursiveCharacterChunker,
    CodeChunker,
)
from RAG.embeddings import (
    BaseEmbeddingModel,
    DeterministicFeatureEmbeddingModel,
    cosine_similarity,
    l2_normalize,
)
from RAG.vector_store import (
    BaseVectorStore,
    InMemoryVectorStore,
    VectorSearchResult,
)
from RAG.retriever import (
    BaseRetriever,
    DenseRetriever,
    SparseBM25Retriever,
    HybridRetriever,
)
from RAG.generator import (
    BaseGenerator,
    MockGroundedGenerator,
    PromptTemplate,
)
from RAG.pipeline import (
    RAGPipeline,
    RAGResponse,
)
from RAG.evaluation import (
    RAGEvaluator,
    EvaluationMetrics,
)

__all__ = [
    "RAGConfig",
    "ChunkingConfig",
    "EmbeddingConfig",
    "VectorStoreConfig",
    "RetrieverConfig",
    "GeneratorConfig",
    "Document",
    "BaseLoader",
    "TextLoader",
    "SourceCodeLoader",
    "DirectoryLoader",
    "BaseChunker",
    "RecursiveCharacterChunker",
    "CodeChunker",
    "BaseEmbeddingModel",
    "DeterministicFeatureEmbeddingModel",
    "cosine_similarity",
    "l2_normalize",
    "BaseVectorStore",
    "InMemoryVectorStore",
    "VectorSearchResult",
    "BaseRetriever",
    "DenseRetriever",
    "SparseBM25Retriever",
    "HybridRetriever",
    "BaseGenerator",
    "MockGroundedGenerator",
    "PromptTemplate",
    "RAGPipeline",
    "RAGResponse",
    "RAGEvaluator",
    "EvaluationMetrics",
]
