"""
Document Loaders for RAG ingestion.
Handles loading plain text, markdown, source code files, and directories.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import uuid


@dataclass
class Document:
    """Represents an ingested text document or snippet."""
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    doc_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def __post_init__(self):
        if "doc_id" not in self.metadata:
            self.metadata["doc_id"] = self.doc_id


class BaseLoader(ABC):
    """Abstract interface for all document loaders."""

    @abstractmethod
    def load(self) -> List[Document]:
        """Loads and returns a list of Document objects."""
        pass


class TextLoader(BaseLoader):
    """Loads plain text files."""

    def __init__(self, file_path: str, encoding: str = "utf-8"):
        self.file_path = Path(file_path)
        self.encoding = encoding

    def load(self) -> List[Document]:
        if not self.file_path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")
        with open(self.file_path, "r", encoding=self.encoding, errors="replace") as f:
            text = f.read()
        metadata = {
            "source": str(self.file_path),
            "file_name": self.file_path.name,
            "extension": self.file_path.suffix,
            "size_bytes": self.file_path.stat().st_size,
        }
        return [Document(content=text, metadata=metadata)]


class SourceCodeLoader(BaseLoader):
    """Loads code files (e.g. C++, Python, TypeScript) preserving metadata."""

    def __init__(self, file_path: str, language: Optional[str] = None, encoding: str = "utf-8"):
        self.file_path = Path(file_path)
        self.language = language or self.file_path.suffix.lstrip(".")
        self.encoding = encoding

    def load(self) -> List[Document]:
        if not self.file_path.exists():
            raise FileNotFoundError(f"Source file not found: {self.file_path}")
        with open(self.file_path, "r", encoding=self.encoding, errors="replace") as f:
            lines = f.readlines()
        text = "".join(lines)
        metadata = {
            "source": str(self.file_path),
            "file_name": self.file_path.name,
            "language": self.language,
            "line_count": len(lines),
        }
        return [Document(content=text, metadata=metadata)]


class DirectoryLoader(BaseLoader):
    """Recursively scans and loads files matching specified patterns."""

    def __init__(
        self,
        directory_path: str,
        glob_pattern: str = "**/*.*",
        exclude_dirs: Optional[List[str]] = None,
        encoding: str = "utf-8"
    ):
        self.directory_path = Path(directory_path)
        self.glob_pattern = glob_pattern
        self.exclude_dirs = exclude_dirs or [".git", "node_modules", "__pycache__", ".next", "dist", "build"]
        self.encoding = encoding

    def load(self) -> List[Document]:
        documents: List[Document] = []
        if not self.directory_path.exists():
            raise FileNotFoundError(f"Directory not found: {self.directory_path}")

        for path in self.directory_path.glob(self.glob_pattern):
            if path.is_file():
                # Check exclusion
                parts = path.parts
                if any(ex in parts for ex in self.exclude_dirs):
                    continue
                try:
                    loader = TextLoader(str(path), encoding=self.encoding)
                    documents.extend(loader.load())
                except Exception:
                    continue  # Skip unreadable binary/corrupted files
        return documents
