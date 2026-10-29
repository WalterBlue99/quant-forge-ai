import { describe, expect, it } from "vitest";
import indexJson from "../src/data/quant-forge-index.json";
import { retrieve, toCitations } from "../src/lib/retrieval";
import type { QuantForgeIndex } from "../src/lib/types";

const index = indexJson as QuantForgeIndex;

describe("retrieval", () => {
  it("contains the expected Date and DayCounter public classes", () => {
    expect(index.symbols.some((symbol) => symbol.name === "Date" && symbol.file === "ql/time/date.hpp")).toBe(true);
    expect(index.symbols.some((symbol) => symbol.name === "DayCounter" && symbol.file === "ql/time/daycounter.hpp")).toBe(true);
  });

  it("finds real Black formula API symbols", () => {
    const results = retrieve(index, "Which function is useful for Black-Scholes option pricing?");
    expect(results.some((result) => result.symbol.name === "blackFormula")).toBe(true);
  });

  it("finds a real GARCH model and returns source citations", () => {
    const results = retrieve(index, "Does QuantForge support GARCH volatility models?");
    expect(results.some((result) => result.symbol.name === "Garch11")).toBe(true);
    expect(toCitations(results)[0]).toMatchObject({ file: expect.stringContaining("ql/") });
  });

  it("returns no source for unrelated requests", () => {
    expect(retrieve(index, "Write me a recipe for lasagna")).toEqual([]);
  });
});
