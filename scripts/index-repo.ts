import { execFileSync } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { createIndex, parseHeader } from "./indexer-core";

const appRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(appRoot, "..", "quant-forge");
const outputFile = path.join(appRoot, "src", "data", "quant-forge-index.json");
const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git", "__pycache__", "build", "builds", "dist", "node_modules", "venv", ".venv", "test-suite", "Examples",
]);

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) files.push(...await walk(path.join(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".hpp")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function revision(): string | undefined {
  try {
    return execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const publicHeaders = path.join(repositoryRoot, "ql");
  if (!existsSync(publicHeaders)) {
    throw new Error(`QuantForge public headers were not found at ${publicHeaders}. Clone the sibling repository before running npm run index-repo.`);
  }
  const headers = await walk(publicHeaders);
  const symbols = [];
  for (const header of headers) {
    const content = await fs.readFile(header, "utf8");
    const relativeFile = path.relative(repositoryRoot, header).split(path.sep).join("/");
    symbols.push(...parseHeader(relativeFile, content));
  }
  const readmePath = path.join(repositoryRoot, "README.md");
  const readmeSummary = existsSync(readmePath) ? (await fs.readFile(readmePath, "utf8")).trim() : "";
  const index = createIndex(symbols, new Date().toISOString(), revision(), readmeSummary);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Indexed ${index.symbols.length} public symbols from ${headers.length} headers into ${path.relative(appRoot, outputFile)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
