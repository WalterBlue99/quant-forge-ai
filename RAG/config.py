"""
Configuration settings for the RAG (Retrieval-Augmented Generation) pipeline.
Defines parameters for document ingestion, chunking, embedding, vector storage,
retrieval, and LLM generation.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ChunkingConfig:
    """Configuration for document splitting and chunking."""
    chunk_size: int = 512
    chunk_overlap: int = 64
    separators: List[str] = field(default_factory=lambda: ["\n\n", "\n", " ", ""])
    keep_separator: bool = True


@dataclass
class EmbeddingConfig:
    """Configuration for vector embeddings."""
    model_name: str = "text-embedding-3-small"
    dimension: int = 1536
    batch_size: int = 64
    normalize_embeddings: bool = True


@dataclass
class VectorStoreConfig:
    """Configuration for vector database storage and indexing."""
    index_type: str = "flat_l2"  # 'flat_l2', 'cosine', 'hnsw'
    distance_metric: str = "cosine"
    persist_path: Optional[str] = None


@dataclass
class RetrieverConfig:
    """Configuration for context retrieval and reranking."""
    top_k: int = 5
    similarity_threshold: float = 0.65
    use_hybrid_search: bool = True
    dense_weight: float = 0.7
    sparse_weight: float = 0.3
    rerank: bool = False
    rerank_top_k: int = 3


@dataclass
class GeneratorConfig:
    """Configuration for LLM response generation."""
    model_name: str = "gemini-2.0-flash"
    temperature: float = 0.1
    max_tokens: int = 2048
    system_prompt: str = (
        "You are an expert technical assistant. Answer the user prompt using ONLY "
        "the provided retrieved context. If the context does not contain the answer, "
        "explicitly state that the information is unavailable. Do not hallucinate."
    )


@dataclass
class RAGConfig:
    """Master configuration uniting all RAG subsystem configurations."""
    chunking: ChunkingConfig = field(default_factory=ChunkingConfig)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    vector_store: VectorStoreConfig = field(default_factory=VectorStoreConfig)
    retriever: RetrieverConfig = field(default_factory=RetrieverConfig)
    generator: GeneratorConfig = field(default_factory=GeneratorConfig)
