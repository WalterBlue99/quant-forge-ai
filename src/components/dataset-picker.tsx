"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { summarizeDataset } from "@/lib/dataset";
import type { DatasetMetadata } from "@/lib/types";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface DatasetPickerProps {
  dataset?: DatasetMetadata;
  onDataset: (dataset?: DatasetMetadata) => void;
}

export function DatasetPicker({ dataset, onDataset }: DatasetPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  const parseFile = (file?: File) => {
    if (!file) return;
    setError(undefined);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("CSV files must be 5 MB or smaller.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      preview: 3,
      complete: ({ data, meta, errors }) => {
        if (errors.length || meta.fields?.length === 0) {
          setError("The CSV could not be read as a header-based table.");
          return;
        }
        const rows = data.map((row) => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, value || null]),
        ));
        onDataset(summarizeDataset(file.name, meta.fields ?? [], rows));
      },
      error: () => setError("The CSV could not be read."),
    });
  };

  if (dataset) {
    return (
      <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/8 p-3 text-sm text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">CSV · {dataset.fileName}</span>
          <button className="text-slate-300 underline decoration-slate-500 underline-offset-4 hover:text-white" onClick={() => onDataset(undefined)} type="button">Remove</button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{dataset.columns.map((column) => `${column.name} (${column.type})`).join(" · ")}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-dashed border-slate-700 px-2 py-1 transition hover:border-cyan-400/50"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); parseFile(event.dataTransfer.files?.[0]); }}
    >
      <input ref={input} className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => parseFile(event.target.files?.[0])} />
      <button className="text-xs text-slate-400 transition hover:text-cyan-200" type="button" onClick={() => input.current?.click()}>
        + Attach a CSV schema
      </button>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
