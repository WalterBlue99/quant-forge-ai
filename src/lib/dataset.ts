import type { DatasetColumn, DatasetMetadata } from "@/lib/types";

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const DATE_LIKE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T].*)?$/;

export function inferColumnType(values: Array<string | null | undefined>): DatasetColumn["type"] {
  const populated = values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);

  if (populated.length === 0) return "empty";
  const matches = (predicate: (value: string) => boolean) => populated.every(predicate);
  if (matches((value) => NUMBER.test(value.replaceAll(",", "")))) return "number";
  if (matches((value) => /^(true|false)$/i.test(value))) return "boolean";
  if (matches((value) => DATE_LIKE.test(value))) return "date-like";
  return "string";
}

export function summarizeDataset(
  fileName: string,
  headers: string[],
  rows: Record<string, string | null>[],
): DatasetMetadata {
  return {
    fileName,
    columns: headers.map((name) => ({
      name,
      type: inferColumnType(rows.map((row) => row[name])),
    })),
    previewRows: rows.slice(0, 3),
  };
}
