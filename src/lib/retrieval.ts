import type { IndexedSymbol, QuantForgeIndex, SourceCitation } from "@/lib/types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "class", "does", "for", "forge", "from", "function", "i", "in", "is", "it", "my", "of", "on",
  "or", "quant", "quantforge", "should", "support", "the", "to", "use", "useful", "what", "which", "with", "write",
]);

const EXPANSIONS: Record<string, string[]> = {
  "black-scholes": ["black", "formula", "option", "pricing"],
  blackscholes: ["black", "formula", "option", "pricing"],
  black: ["formula", "option", "pricing"],
  garch: ["garch", "volatility"],
  csv: ["time", "series", "date"],
  dataset: ["time", "series", "date"],
  close: ["time", "series", "quote"],
  volume: ["time", "series"],
};

export interface RetrievalResult {
  symbol: IndexedSymbol;
  score: number;
}

export function tokenize(value: string, includeExpansions = true): string[] {
  const expanded = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  return [...new Set(expanded.flatMap((token) => includeExpansions ? [
    token,
    ...(Object.hasOwn(EXPANSIONS, token) ? EXPANSIONS[token] : []),
  ] : [token]))];
}

function dice(left: string, right: string): number {
  if (left.length < 3 || right.length < 3) return 0;
  const grams = (value: string) => {
    const items = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) items.add(value.slice(index, index + 2));
    return items;
  };
  const a = grams(left);
  const b = grams(right);
  let overlap = 0;
  for (const gram of a) if (b.has(gram)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

function scoreSymbol(symbol: IndexedSymbol, queryTerms: string[], query: string): number {
  const nameTerms = tokenize(`${symbol.name} ${symbol.qualifiedName}`, false);
  const signatureTerms = tokenize(symbol.signature, false);
  const documentationTerms = tokenize(symbol.documentation, false);
  let score = 0;

  for (const term of queryTerms) {
    if (nameTerms.includes(term)) score += 30;
    if (signatureTerms.includes(term)) score += 8;
    if (documentationTerms.includes(term)) score += 3;
    const closest = Math.max(0, ...nameTerms.map((candidate) => dice(term, candidate)));
    if (closest >= 0.88) score += closest * 5;
  }

  // GARCH is a precise domain query; prefer the specifically indexed model over generic volatility symbols.
  if (queryTerms.includes("garch") && nameTerms.includes("garch")) score += 100;

  if (/\bfunction\b/i.test(query) && symbol.kind === "function") score += 40;
  if (/\bclass\b/i.test(query) && symbol.kind === "class") score += 40;
  return score;
}

export function retrieve(index: QuantForgeIndex, query: string, limit = 8): RetrievalResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  return index.symbols
    .map((symbol) => ({ symbol, score: scoreSymbol(symbol, terms, query) }))
    .filter((result) => result.score >= 10)
    .sort((a, b) => b.score - a.score || a.symbol.qualifiedName.localeCompare(b.symbol.qualifiedName))
    .slice(0, limit);
}

export function toCitations(results: RetrievalResult[]): SourceCitation[] {
  const seen = new Set<string>();
  return results
    .filter(({ symbol }) => !seen.has(symbol.id) && Boolean(seen.add(symbol.id)))
    .map(({ symbol }) => ({
      id: symbol.id,
      name: symbol.qualifiedName,
      signature: symbol.signature,
      file: symbol.file,
      line: symbol.line,
    }));
}
