import type { ChatMessage, DatasetMetadata, SourceCitation } from "@/lib/types";

export interface ValidatedChatRequest {
  messages: ChatMessage[];
  dataset?: DatasetMetadata;
}

const MAX_MESSAGE_LENGTH = 6_000;
const MAX_MESSAGES = 12;

export function validateChatRequest(value: unknown): ValidatedChatRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { messages?: unknown; dataset?: unknown };
  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > MAX_MESSAGES) return null;

  const messages: ChatMessage[] = [];
  for (const message of input.messages) {
    if (!message || typeof message !== "object") return null;
    const item = message as { role?: unknown; content?: unknown };
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return null;
    const content = item.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role: item.role, content });
  }

  const dataset = validateDataset(input.dataset);
  if (input.dataset !== undefined && !dataset) return null;
  return { messages, dataset };
}

function validateDataset(value: unknown): DatasetMetadata | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") return undefined;
  const input = value as Partial<DatasetMetadata>;
  if (typeof input.fileName !== "string" || !Array.isArray(input.columns) || !Array.isArray(input.previewRows)) return undefined;
  if (input.fileName.length > 200 || input.columns.length > 100 || input.previewRows.length > 3) return undefined;
  if (!input.columns.every((column) => column && typeof column.name === "string" && typeof column.type === "string")) return undefined;
  if (!input.previewRows.every((row) => row && typeof row === "object")) return undefined;
  return input as DatasetMetadata;
}

export function buildSystemPrompt(
  sources: SourceCitation[],
  dataset?: DatasetMetadata,
): string {
  const sourceText = sources
    .map((source, index) => `[S${index + 1}] ${source.name}\n${source.signature}\n${source.file}:${source.line}`)
    .join("\n\n");
  const datasetText = dataset
    ? `Dataset metadata only (never analyze or request raw rows): ${JSON.stringify(dataset)}`
    : "No dataset metadata was supplied.";

  return `You are QuantForge AI Assistant, a guidance-only assistant for a C++ QuantLib-based repository.
You may recommend ONLY QuantForge APIs contained in the SOURCES below. Do not invent, rename, or infer APIs. If the supplied sources do not support a requested capability, state that the capability is not represented by the indexed sources and offer general quantitative-programming advice without naming unverified libraries or APIs.
Use C++ only. Do not execute code, process a raw dataset, modify a repository, or claim that you did. Keep code samples limited to APIs present in SOURCES. Explain assumptions succinctly and cite source labels like [S1] in prose.

SOURCES:\n${sourceText}\n\n${datasetText}`;
}

export function sourceEvent(sources: SourceCitation[]): string {
  return `event: sources\ndata: ${JSON.stringify(sources)}\n\n`;
}

export function sseEvent(event: "delta" | "done" | "error", data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
