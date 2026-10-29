"""
LLM Generation and Prompt Synthesis for RAG.
Constructs source-grounded prompts and handles generation interfaces.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from RAG.loader import Document
from RAG.vector_store import VectorSearchResult


@dataclass
class PromptTemplate:
    """Template for formatting retrieved context into LLM system prompts."""
    system_instruction: str = (
        "You are an expert AI assistant specializing in quantitative finance and C++ code.\n"
        "RULES:\n"
        "1. Answer ONLY using the facts directly asserted in the RETRIEVED CONTEXT below.\n"
        "2. If the context does not contain sufficient information, state: "
        "'The retrieved codebase index does not contain this feature or symbol.'\n"
        "3. Provide code signatures and source file paths whenever available.\n"
        "4. DO NOT hallucinate nonexistent classes or methods."
    )

    def format(self, query: str, context_results: List[VectorSearchResult]) -> str:
        formatted_context_blocks = []
        for idx, res in enumerate(context_results, start=1):
            source = res.document.metadata.get("source", "Unknown file")
            line = res.document.metadata.get("line", "")
            loc = f"{source}:{line}" if line else source
            formatted_context_blocks.append(
                f"[Source {idx}] ({loc})\n{res.document.content.strip()}"
            )

        context_str = "\n\n".join(formatted_context_blocks) if formatted_context_blocks else "NO RELEVANT CONTEXT FOUND."

        return (
            f"=== SYSTEM INSTRUCTIONS ===\n{self.system_instruction}\n\n"
            f"=== RETRIEVED CONTEXT ===\n{context_str}\n\n"
            f"=== USER QUERY ===\n{query}\n\n"
            f"=== GROUNDED RESPONSE ==="
        )


class BaseGenerator(ABC):
    """Abstract interface for generation engines."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Generates a text completion given a prompt."""
        pass


class MockGroundedGenerator(BaseGenerator):
    """
    Mock generator for testing without requiring active cloud API credits.
    Synthesizes answers directly citing matched context snippets.
    """

    def generate(self, prompt: str) -> str:
        if "NO RELEVANT CONTEXT FOUND" in prompt:
            return (
                "I couldn't find an indexed QuantForge API that matches this request. "
                "This assistant only recommends symbols found in the indexed repository."
            )
        return (
            "Based on the retrieved QuantForge codebase, here are the relevant components "
            "and declarations matching your request.\n\n"
            "[Extracted directly from indexed context with verified file references.]"
        )
