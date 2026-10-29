"""
Text and Code Splitters / Chunkers for RAG.
Breaks large documents into smaller chunks suitable for embedding models
and vector retrieval while maintaining context and metadata.
"""

from abc import ABC, abstractmethod
from typing import List, Optional
import re
from RAG.loader import Document


class BaseChunker(ABC):
    """Abstract interface for document chunkers."""

    @abstractmethod
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Splits a list of documents into smaller chunked Document objects."""
        pass


class RecursiveCharacterChunker(BaseChunker):
    """
    Recursively splits text using a hierarchy of separators
    (e.g. double newlines, single newlines, sentences, words).
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
        separators: Optional[List[str]] = None,
        keep_separator: bool = True
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]
        self.keep_separator = keep_separator

    def split_documents(self, documents: List[Document]) -> List[Document]:
        chunked_docs: List[Document] = []
        for doc in documents:
            chunks = self._split_text(doc.content, self.separators)
            for idx, chunk in enumerate(chunks):
                chunk_meta = dict(doc.metadata)
                chunk_meta["chunk_index"] = idx
                chunk_meta["total_chunks"] = len(chunks)
                chunk_meta["char_length"] = len(chunk)
                chunked_docs.append(Document(content=chunk, metadata=chunk_meta))
        return chunked_docs

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators = []

        for i, sep in enumerate(separators):
            if sep == "" or sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator != "" else list(text)

        good_splits: List[str] = []
        for s in splits:
            if len(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    good_splits.extend(self._split_text(s, new_separators))
                else:
                    good_splits.append(s)

        # Merge splits up to chunk_size with overlap
        merged: List[str] = []
        current: List[str] = []
        current_len = 0

        for piece in good_splits:
            piece_len = len(piece)
            if current_len + piece_len > self.chunk_size and current:
                merged.append(separator.join(current).strip())
                # Overlap retention
                while current and current_len > self.chunk_overlap:
                    removed = current.pop(0)
                    current_len -= len(removed) + len(separator)
            current.append(piece)
            current_len += piece_len + len(separator)

        if current:
            merged.append(separator.join(current).strip())

        return [m for m in merged if m]


class CodeChunker(BaseChunker):
    """
    Chunker optimized for source code (C++, Python, TS) splitting by
    class definitions, functions, or block structures.
    """

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_documents(self, documents: List[Document]) -> List[Document]:
        chunked: List[Document] = []
        for doc in documents:
            # Split primarily on double newlines or function/class boundaries
            blocks = re.split(r"\n(?=(?:class |def |struct |namespace |\/\*\*))", doc.content)
            for idx, block in enumerate(blocks):
                block = block.strip()
                if not block:
                    continue
                meta = dict(doc.metadata)
                meta["code_block_index"] = idx
                chunked.append(Document(content=block, metadata=meta))
        return chunked
