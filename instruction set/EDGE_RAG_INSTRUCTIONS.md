# In-Browser Edge RAG Instructions: QuantForge GitHub Integration

> Comprehensive technical blueprint and instruction set for executing a client-side, zero-server-cost Retrieval-Augmented Generation (RAG) agent that directly ingests [WalterBlue99/quant-forge](https://github.com/WalterBlue99/quant-forge) and answers coding and quantitative queries locally in the browser.

---

## 1. Executive Architecture Overview

Running RAG directly at the edge inside the user's web browser eliminates backend compute and hosting costs ($0 budget), protects user privacy, and enables offline-capable codebase analysis.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER (EDGE)                           │
│                                                                        │
│  1. Ingestion: GitHub REST API / Raw Content Fetcher                   │
│     Target: https://github.com/WalterBlue99/quant-forge                │
│     Paths:  ql/**/*.hpp, ql/**/*.cpp, README.md                        │
│                                                                        │
│  2. Client-Side Persistent Cache                                       │
│     IndexedDB / CacheStorage (ETag & Commit SHA Tracking)              │
│                                                                        │
│  3. In-Browser Parser & Tokenizer                                      │
│     Web Worker / Regex & AST Parser -> QuantForge Symbols & Signatures │
│                                                                        │
│  4. Client-Side Index & Retrieval                                      │
│     - In-Memory BM25 Lexical Search                                    │
│     - Client-Side Vector Embeddings (Transformers.js / WebGPU)         │
│     - Top-k Ranked Context Selection                                   │
│                                                                        │
│  5. Edge Generation Engine                                             │
│     WebLLM / ONNX Runtime Web / Transformers.js via WebGPU / Wasm      │
│     (e.g., Qwen-2.5-Coder-1.5B-Instruct-q4f16 / Llama-3.2-1B-Instruct) │
│                                                                        │
│  6. Reactive UI Display                                                │
│     Real-time token streaming with source file citations               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ingesting the GitHub Repository Directly from the Browser

### 2.1 Repository Metadata & File Tree Ingestion
To read the repository without cloning the full git history:
1. **Fetch Commit SHA & Tree**:
   Query GitHub's Trees API for recursive file manifest:
   ```http
   GET https://api.github.com/repos/WalterBlue99/quant-forge/git/trees/main?recursive=1
   Accept: application/vnd.github.v3+json
   ```
2. **Filter Header & Source Files**:
   Filter the returned tree objects to keep only relevant quantitative files:
   - Include: `ql/**/*.hpp`, `ql/**/*.cpp`, `README.md`, `AGENTS.md`
   - Exclude: `.git`, `build/`, `test-suite/`, `bin/`, image/binary files
3. **Download Raw File Contents**:
   Fetch individual file contents directly from GitHub's CDN:
   ```http
   GET https://raw.githubusercontent.com/WalterBlue99/quant-forge/main/{path}
   ```
   Or batch-fetch using the GitHub Blobs API.

### 2.2 Client-Side Caching in IndexedDB
To respect GitHub API rate limits (60 unauthenticated requests/hr per IP) and avoid re-downloading unchanged files:
- Cache parsed symbols, headers, and AST extracts into the browser's `IndexedDB` (using `idb` or `localforage`).
- Store the latest Git commit SHA. Check GitHub `HEAD` commit before re-fetching; if unchanged, load instantly from local IndexedDB cache.

---

## 3. In-Browser Code Parsing & Lightweight Retrieval

### 3.1 Header Parsing Strategy
Execute a background `Web Worker` to parse C++ headers into structured metadata without freezing the UI thread:
- Extract namespace definitions (`namespace QuantLib`)
- Class names, inheritance hierarchies, and constructors (`class EuropeanOption : public OneAssetOption`)
- Public member functions and pricing signatures (`Real NPV() const`, `Real impliedVolatility(...)`)
- Doxygen comments (`\file`, `\brief`, `@param`, `@return`)

### 3.2 Dual Retrieval Mechanism (BM25 + WebGPU Embeddings)
1. **Lexical BM25 Search**:
   - Maintain an in-memory inverted index of symbol names, class names, file stems, and Doxygen keywords.
   - Use token expansions for quantitative terms (e.g. `black-scholes` -> `blackFormula`, `pricing`, `option`).
2. **Semantic Dense Search via WebAssembly / WebGPU**:
   - Run a lightweight embedding model inside the browser using `@xenova/transformers` (e.g. `Xenova/all-MiniLM-L6-v2` or `Xenova/bge-small-en-v1.5`).
   - Compute cosine similarity across cached symbol embeddings directly in a typed array (`Float32Array`).
3. **Re-Ranking & Score Fusion**:
   - Combine scores using Reciprocal Rank Fusion (RRF) to produce the top 5 to 8 most relevant context passages.

---

## 4. System Prompt & Instruction Set for Edge Generation

When feeding the retrieved QuantForge repository context to the in-browser model (e.g. WebLLM / Transformers.js), inject the following **Strict Grounding Instruction Set**:

```markdown
You are the QuantForge AI Assistant, an edge-computed coding and research guide for the open-source QuantForge codebase (https://github.com/WalterBlue99/quant-forge).

### CORE RULES & GUARDRAILS:
1. STRICT ZERO-HALLUCINATION POLICY:
   - Recommend ONLY classes, functions, macros, and modules that explicitly exist in the RETRIEVED QUANTFORGE CONTEXT below.
   - Do NOT invent hypothetical QuantForge methods, flags, or headers.
   - If a requested model, feature, or function does NOT exist in QuantForge (e.g., if a user asks for an exotic model not implemented in the codebase), explicitly state:
     "QuantForge does not currently support [Feature]. The indexed repository only contains [Related Symbols]."
     Then provide general quantitative C++ or Python guidance clearly labeled as general knowledge.

2. QUANTFORGE CODING CONVENTIONS:
   - Target modern C++ (C++17 baseline).
   - Use QuantLib portability pointers: `ext::shared_ptr<T>`, `ext::make_shared<T>(...)`, `ext::dynamic_pointer_cast<T>(...)`.
   - Never use raw throw/assert; use QuantLib error macros: `QL_REQUIRE`, `QL_ENSURE`, `QL_FAIL`, `QL_ASSERT`.
   - Result accessors do not recompute on demand (NPV is cached by lazy evaluation). Note that dependencies must arrive as observables (`Handle<Quote>`, `Handle<YieldTermStructure>`).
   - Use `Settings::instance().evaluationDate()` for global evaluation dates.

3. CITATION REQUIREMENTS:
   - For every class or function you recommend, cite its exact header path (e.g., `ql/instruments/vanillaswap.hpp`, `ql/time/date.hpp`).
   - Provide minimal, clean, compilable C++ code snippets demonstrating constructor calls, engine linking, and calculations.

4. SCOPE BOUNDARIES:
   - Guidance and code recommendations only.
   - Never simulate real-time market data or claim code execution occurred.
```

---

## 5. WebLLM / In-Browser Inference Setup

To run generative inference completely on the edge without backend servers:
1. **Engine**: Use `@mlc-ai/web-llm` targeting WebGPU.
2. **Recommended Models**:
   - `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (Outstanding C++ syntax and quant reasoning; ~1.1 GB VRAM)
   - `Llama-3.2-1B-Instruct-q4f16_1-MLC` (Fast, lightweight edge inference; ~900 MB VRAM)
   - `SmolLM2-1.7B-Instruct-q4f16_1-MLC`
3. **Browser Compatibility Check**:
   - Check `navigator.gpu`:
     ```javascript
     if (!navigator.gpu) {
       console.warn("WebGPU is not supported on this browser. Falling back to Wasm or server proxy.");
     }
     ```
4. **Context Window Management**:
   - Limit context injection to top 4-6 retrieved signatures and docstrings (~800 tokens) to ensure fast token generation (>30 tokens/sec on consumer GPUs).

---

## 6. End-to-End Edge Execution Blueprint (TypeScript)

```typescript
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { openDB } from "idb";

// 1. Ingest repo tree from GitHub
async function syncQuantForgeRepo() {
  const db = await openDB("quant-forge-cache", 1, {
    upgrade(db) { db.createObjectStore("symbols", { keyPath: "id" }); }
  });

  const response = await fetch(
    "https://api.github.com/repos/WalterBlue99/quant-forge/git/trees/main?recursive=1"
  );
  const treeData = await response.json();
  const headers = treeData.tree.filter((node: any) => node.path.startsWith("ql/") && node.path.endsWith(".hpp"));

  // Fetch and parse in batch with local caching...
  return headers;
}

// 2. Perform local in-memory BM25 retrieval
function retrieveEdgeContext(query: string, indexedSymbols: any[]): any[] {
  const tokens = query.toLowerCase().split(/\s+/);
  return indexedSymbols
    .map(sym => ({
      symbol: sym,
      score: tokens.filter(t => sym.name.toLowerCase().includes(t)).length
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// 3. Generate response with WebLLM
async function askQuantForgeEdge(query: string, indexedSymbols: any[]) {
  const topSources = retrieveEdgeContext(query, indexedSymbols);
  const engine = await CreateMLCEngine("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC");

  const systemPrompt = `You are QuantForge AI Assistant. Ground answers ONLY in:\n` +
    topSources.map(s => `${s.symbol.file}: ${s.symbol.signature}`).join("\n");

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    temperature: 0.1,
    stream: true
  });

  for await (const chunk of reply) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}
```

---

## 7. Summary
By following these instructions, an edge RAG system can:
- Ingest the official repository `https://github.com/WalterBlue99/quant-forge` directly from the browser.
- Cache symbol structures in client `IndexedDB`.
- Execute hybrid BM25 / vector retrieval completely in-memory.
- Run local WebGPU inference with zero hallucinations, guaranteeing complete privacy and ₹0 server costs.
