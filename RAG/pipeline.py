"""
End-to-end RAG (Retrieval-Augmented Generation) Orchestration Pipeline.
Coordinates Document Ingestion -> Chunking -> Vector Indexing ->
Retrieval -> Grounded Prompt Synthesis -> LLM Response Generation.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from RAG.config import RAGConfig
from RAG.loader import BaseLoader, Document
from RAG.chunker import BaseChunker, RecursiveCharacterChunker
from RAG.embeddings import BaseEmbeddingModel, DeterministicFeatureEmbeddingModel
from RAG.vector_store import BaseVectorStore, InMemoryVectorStore, VectorSearchResult
from RAG.retriever import BaseRetriever, DenseRetriever, SparseBM25Retriever, HybridRetriever
from RAG.generator import BaseGenerator, MockGroundedGenerator, PromptTemplate


@dataclass
class RAGResponse:
    """Encapsulates the final generated answer and source documents."""
    answer: str
    sources: List[VectorSearchResult]
    query: str


class RAGPipeline:
    """
    Standard production RAG Pipeline uniting all subsystems.
    """

    def __init__(
        self,
        config: Optional[RAGConfig] = None,
        embedding_model: Optional[BaseEmbeddingModel] = None,
        chunker: Optional[BaseChunker] = None,
        generator: Optional[BaseGenerator] = None,
    ):
        self.config = config or RAGConfig()
        self.embedding_model = embedding_model or DeterministicFeatureEmbeddingModel(
            dimension=self.config.embedding.dimension
        )
        self.chunker = chunker or RecursiveCharacterChunker(
            chunk_size=self.config.chunking.chunk_size,
            chunk_overlap=self.config.chunking.chunk_overlap,
        )
        self.vector_store = InMemoryVectorStore(self.embedding_model)
        self.generator = generator or MockGroundedGenerator()
        self.prompt_template = PromptTemplate(
            system_instruction=self.config.generator.system_prompt
        )
        self.retriever: Optional[BaseRetriever] = None
        self._raw_documents: List[Document] = []
        self._chunked_documents: List[Document] = []

    def index_documents(self, documents: List[Document]) -> int:
        """
        Chunks and indexes raw documents into the vector store and BM25 retriever.
        Returns the number of indexed chunks.
        """
        self._raw_documents = documents
        self._chunked_documents = self.chunker.split_documents(documents)
        self.vector_store.add_documents(self._chunked_documents)

        # Initialize hybrid or dense retriever
        dense_ret = DenseRetriever(
            self.vector_store,
            score_threshold=self.config.retriever.similarity_threshold
        )
        if self.config.retriever.use_hybrid_search and self._chunked_documents:
            sparse_ret = SparseBM25Retriever(self._chunked_documents)
            self.retriever = HybridRetriever(
                dense_retriever=dense_ret,
                sparse_retriever=sparse_ret,
                dense_weight=self.config.retriever.dense_weight,
                sparse_weight=self.config.retriever.sparse_weight,
            )
        else:
            self.retriever = dense_ret

        return len(self._chunked_documents)

    def query(self, user_query: str, top_k: Optional[int] = None) -> RAGResponse:
        """
        Retrieves context relevant to the user query and generates a grounded response.
        """
        if self.retriever is None:
            raise RuntimeError("No documents have been indexed in the RAG pipeline yet.")

        k = top_k or self.config.retriever.top_k
        results = self.retriever.retrieve(user_query, top_k=k)
        prompt = self.prompt_template.format(user_query, results)
        answer = self.generator.generate(prompt)

        return RAGResponse(
            answer=answer,
            sources=results,
            query=user_query,
        )
