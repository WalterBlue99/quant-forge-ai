import { createHash } from "node:crypto";
import type { IndexedParameter, IndexedSymbol, QuantForgeIndex, SymbolKind } from "../src/lib/types";

interface ClassRange {
  name: string;
  start: number;
  end: number;
}

export function splitSearchTerms(value: string): string[] {
  return [...new Set(value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1))];
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function cleanDocumentation(comment: string): string {
  return comment
    .replace(/^\/\*+!?|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, "").replace(/\\(brief|ingroup|warning|test|name)\b/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentationBefore(content: string, index: number): string {
  const before = content.slice(0, index);
  const docStart = Math.max(before.lastIndexOf("/*!"), before.lastIndexOf("/**"));
  if (docStart >= 0) {
    const docEnd = before.indexOf("*/", docStart);
    if (docEnd >= 0 && before.slice(docEnd + 2).trim() === "") {
      return cleanDocumentation(before.slice(docStart, docEnd + 2));
    }
  }

  const lines = before.split("\n");
  const comments: string[] = [];
  for (let offset = lines.length - 1; offset >= 0; offset -= 1) {
    const line = lines[offset].trim();
    if (!line) continue;
    if (line.startsWith("//!") || line.startsWith("///")) comments.unshift(line.replace(/^\/\/[/!]\s?/, ""));
    else break;
  }
  return comments.join(" ").trim();
}

function stripCommentsAndPreprocessor(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (match) => " ".repeat(match.length))
    .replace(/^\s*#.*$/gm, (match) => " ".repeat(match.length));
}

function findClosingBrace(content: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < content.length; index += 1) {
    if (content[index] === "{") depth += 1;
    if (content[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return content.length;
}

function findClasses(content: string): ClassRange[] {
  const output: ClassRange[] = [];
  const pattern = /\b(class|struct)\s+([A-Za-z_]\w*)[^;{]*\{/g;
  for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
    const open = content.indexOf("{", match.index);
    output.push({ name: match[2], start: match.index, end: findClosingBrace(content, open) });
  }
  return output;
}

function splitParameters(value: string): IndexedParameter[] {
  const parts: string[] = [];
  let current = "";
  let angleDepth = 0;
  let parenDepth = 0;
  for (const character of value) {
    if (character === "<") angleDepth += 1;
    if (character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (character === "(") parenDepth += 1;
    if (character === ")") parenDepth = Math.max(0, parenDepth - 1);
    if (character === "," && angleDepth === 0 && parenDepth === 0) {
      parts.push(current);
      current = "";
    } else current += character;
  }
  if (current.trim()) parts.push(current);

  return parts
    .map((part) => part.replace(/\s*=\s*[^,]+$/, "").trim())
    .filter((part) => part && part !== "void")
    .map((part) => {
      const tokens = part.split(/\s+/);
      const name = tokens.length > 1 ? (tokens.pop() ?? "") : "";
      return { name: name.replace(/[&*]/g, ""), type: tokens.join(" ") || part };
    });
}

function makeId(file: string, line: number, qualifiedName: string): string {
  return createHash("sha1").update(`${file}:${line}:${qualifiedName}`).digest("hex").slice(0, 14);
}

function makeSymbol(
  input: Omit<IndexedSymbol, "id" | "searchTerms">,
): IndexedSymbol {
  return {
    ...input,
    id: makeId(input.file, input.line, input.qualifiedName),
    searchTerms: splitSearchTerms(`${input.qualifiedName} ${input.signature} ${input.documentation} ${input.file}`),
  };
}

export function parseHeader(file: string, content: string): IndexedSymbol[] {
  const sanitized = stripCommentsAndPreprocessor(content);
  const modulePath = file.split("/").slice(0, -1).join("/");
  const classes = findClasses(sanitized);
  const symbols: IndexedSymbol[] = [];
  const unique = new Set<string>();
  const namespaceMatch = /namespace\s+(\w+)/.exec(sanitized);
  const namespace = namespaceMatch?.[1] ?? "QuantLib";
  const add = (symbol: IndexedSymbol) => {
    const key = `${symbol.kind}:${symbol.qualifiedName}:${symbol.line}`;
    if (!unique.has(key)) {
      unique.add(key);
      symbols.push(symbol);
    }
  };

  for (const match of sanitized.matchAll(/\b(class|struct)\s+([A-Za-z_]\w*)[^;{]*\{/g)) {
    const kind = match[1] as "class" | "struct";
    const name = match[2];
    const line = lineAt(content, match.index ?? 0);
    add(makeSymbol({
      kind,
      name,
      qualifiedName: `${namespace}::${name}`,
      signature: `${kind} ${name}`,
      parameters: [],
      documentation: documentationBefore(content, match.index ?? 0),
      file,
      line,
      module: modulePath,
    }));
  }

  const functionPattern = /(?:^|\n)\s*((?:(?:template\s*<[^>{;]+>\s*)|(?:virtual|static|inline|explicit|friend|constexpr|consteval|QL_[A-Z_]+)\s*)*)([A-Za-z_~][\w:<>,\s&*]*?)\s+([~A-Za-z_]\w*|operator\S+)\s*\(([^(){};]{0,900})\)\s*(const)?\s*(?:noexcept)?\s*(?:override)?\s*(?:=\s*0)?\s*(?:;|\{)/g;

  for (const match of sanitized.matchAll(functionPattern)) {
    const index = (match.index ?? 0) + match[0].indexOf(match[3]);
    const name = match[3];
    const returnType = match[2].replace(/\s+/g, " ").trim();
    if (!returnType || ["if", "for", "while", "switch", "return"].includes(returnType)) continue;
    const parent = classes
      .filter((range) => index > range.start && index < range.end)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0]?.name;
    const kind: SymbolKind = parent ? "method" : "function";
    const qualifiers = match[5] ? " const" : "";
    const signature = `${returnType} ${name}(${match[4].replace(/\s+/g, " ").trim()})${qualifiers}`;
    const line = lineAt(content, index);
    const declarationIndex = (match.index ?? 0) + match[0].indexOf(match[2]);
    add(makeSymbol({
      kind,
      name,
      qualifiedName: `${namespace}::${parent ? `${parent}::` : ""}${name}`,
      signature,
      parameters: splitParameters(match[4]),
      documentation: documentationBefore(content, declarationIndex),
      file,
      line,
      module: modulePath,
      parent,
    }));
  }

  for (const match of sanitized.matchAll(/\b(enum|typedef)\s+(?:class\s+)?([A-Za-z_]\w*)/g)) {
    const kind = match[1] as "enum" | "typedef";
    const name = match[2];
    const line = lineAt(content, match.index ?? 0);
    add(makeSymbol({
      kind,
      name,
      qualifiedName: `${namespace}::${name}`,
      signature: `${kind} ${name}`,
      parameters: [],
      documentation: documentationBefore(content, match.index ?? 0),
      file,
      line,
      module: modulePath,
    }));
  }

  return symbols;
}

export function createIndex(symbols: IndexedSymbol[], generatedAt: string, revision?: string, readmeSummary = ""): QuantForgeIndex {
  const documents = [...new Map(symbols.map((symbol) => [symbol.file, {
    file: symbol.file,
    module: symbol.module,
    summary: symbol.documentation,
  }])).values(), {
    file: "README.md",
    module: "",
    summary: readmeSummary,
  }].sort((a, b) => a.file.localeCompare(b.file));

  return {
    version: 1,
    generatedAt,
    repository: { name: "quant-forge", readme: "README.md", revision },
    documents,
    symbols: symbols.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
  };
}
