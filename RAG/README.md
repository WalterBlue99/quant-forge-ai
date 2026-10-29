# Standard RAG (Retrieval-Augmented Generation) Architecture

This folder provides a complete, production-standard implementation of a modular **Retrieval-Augmented Generation (RAG)** pipeline. It defines standard interfaces and implementations across all stages of the RAG lifecycle.

## Architectural Overview

```
                      ┌──────────────────────┐
                      │  Raw Documents/Code  │
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │   Document Loaders   │ (loader.py)
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │   Text/Code Chunker  │ (chunker.py)
                      └──────────┬───────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
     ┌──────────────────────┐          ┌──────────────────────┐
     │   Embedding Model    │          │     BM25 Lexical     │
     │  (embeddings.py)     │          │    (retriever.py)    │
     └──────────┬───────────┘          └──────────┬───────────┘
                │                                 │
                ▼                                 │
     ┌──────────────────────┐                     │
     │     Vector Store     │                     │
     │  (vector_store.py)   │                     │
     └──────────┬───────────┘                     │
                │                                 │
                └────────────────┬────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │   Hybrid Retriever   │ (retriever.py - RRF)
                      └──────────┬───────────┘
                                 │ Top-k relevant context
                                 ▼
                      ┌──────────────────────┐
                      │  Context Injection   │ (generator.py)
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │    LLM Generation    │ (generator.py)
                      └──────────┬───────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │ Grounded Answer with │
                      │   Source Citations   │
                      └──────────────────────┘
```

## Module Directory

| Module | File | Responsibility |
|---|---|---|
| **Config** | `config.py` | Dataclass-based configuration for chunking, embeddings, vector stores, retrievers, and generation models. |
| **Document Loaders** | `loader.py` | Loaders for plain text, markdown, source code (`.hpp`, `.cpp`, `.py`), and recursive directory scanning. |
| **Chunking** | `chunker.py` | Recursive character splitting and syntax-aware code chunking with overlap management. |
| **Embeddings** | `embeddings.py` | Embedding interface with deterministic feature hashing, L2 vector normalization, and cosine similarity. |
| **Vector Database** | `vector_store.py` | In-memory and persistent vector storage with k-NN search and metadata filtering. |
| **Retrievers** | `retriever.py` | Dense vector retrieval, BM25 sparse keyword retrieval, and Reciprocal Rank Fusion (RRF) hybrid search. |
| **Generation** | `generator.py` | Grounded prompt templating and LLM generation interface ensuring strict zero-hallucination guardrails. |
| **Pipeline** | `pipeline.py` | Master orchestrator coordinating the ingestion and retrieval-generation query loops. |
| **Evaluation** | `evaluation.py` | Automated assessment of Context Precision, Context Recall, Groundedness, and Faithfulness. |

## Isolation & Non-Interference
This folder contains standard standalone modules and documentation. It does not interfere with the Next.js production web build or runtime.
