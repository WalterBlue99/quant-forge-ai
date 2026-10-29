import { describe, expect, it } from "vitest";
import { createIndex, parseHeader } from "../scripts/indexer-core";

const header = `
namespace QuantLib {
/*! A simple pricing object. */
class Demo {
  public:
    //! Computes a value.
    Real price(Real strike, const Date& expiry) const;
};
/*! Price using a Black-style formula. */
Real blackFormula(Option::Type optionType, Real strike);
}
`;

describe("C++ header indexer", () => {
  it("extracts documented public classes and functions with parameter types", () => {
    const symbols = parseHeader("ql/pricingengines/demo.hpp", header);
    const demo = symbols.find((symbol) => symbol.qualifiedName === "QuantLib::Demo");
    const price = symbols.find((symbol) => symbol.qualifiedName === "QuantLib::Demo::price");
    const formula = symbols.find((symbol) => symbol.qualifiedName === "QuantLib::blackFormula");

    expect(demo?.kind).toBe("class");
    expect(demo?.documentation).toContain("pricing object");
    expect(price?.kind).toBe("method");
    expect(price?.parameters).toEqual([{ name: "strike", type: "Real" }, { name: "expiry", type: "const Date&" }]);
    expect(formula?.documentation).toContain("Black-style");
  });

  it("creates a portable, deterministic index shape", () => {
    const index = createIndex(parseHeader("ql/demo.hpp", header), "2026-10-04T00:00:00.000Z", "abc");
    expect(index.repository).toEqual({ name: "quant-forge", readme: "README.md", revision: "abc" });
    expect(index.documents.some((document) => document.file === "ql/demo.hpp")).toBe(true);
    expect(index.documents.some((document) => document.file === "README.md")).toBe(true);
    expect(index.symbols[0].file).not.toContain("C:");
  });
});
