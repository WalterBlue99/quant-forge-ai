export type SymbolKind = "class" | "struct" | "function" | "method" | "enum" | "typedef";

export interface IndexedParameter {
  name: string;
  type: string;
}

export interface IndexedSymbol {
  id: string;
  kind: SymbolKind;
  name: string;
  qualifiedName: string;
  signature: string;
  parameters: IndexedParameter[];
  documentation: string;
  file: string;
  line: number;
  module: string;
  parent?: string;
  searchTerms: string[];
}

export interface IndexedDocument {
  file: string;
  module: string;
  summary: string;
}

export interface QuantForgeIndex {
  version: number;
  generatedAt: string;
  repository: { name: string; readme: string; revision?: string };
  documents: IndexedDocument[];
  symbols: IndexedSymbol[];
}

export interface DatasetColumn {
  name: string;
  type: "number" | "boolean" | "date-like" | "string" | "empty" | "mixed";
}

export interface DatasetMetadata {
  fileName: string;
  columns: DatasetColumn[];
  previewRows: Record<string, string | null>[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SourceCitation {
  id: string;
  name: string;
  signature: string;
  file: string;
  line: number;
}
