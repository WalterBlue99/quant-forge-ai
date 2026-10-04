import { describe, expect, it } from "vitest";
import { inferColumnType, summarizeDataset } from "../src/lib/dataset";

describe("dataset metadata", () => {
  it("infers types from only preview values", () => {
    expect(inferColumnType(["2026-01-02", "2026-01-03"])).toBe("date-like");
    expect(inferColumnType(["101.25", "102"])).toBe("number");
    expect(inferColumnType(["true", "false"])).toBe("boolean");
  });

  it("limits retained preview rows to three", () => {
    const metadata = summarizeDataset("prices.csv", ["Date", "Close"], [
      { Date: "2026-01-01", Close: "1" },
      { Date: "2026-01-02", Close: "2" },
      { Date: "2026-01-03", Close: "3" },
      { Date: "2026-01-04", Close: "4" },
    ]);
    expect(metadata.previewRows).toHaveLength(3);
    expect(metadata.columns).toEqual([{ name: "Date", type: "date-like" }, { name: "Close", type: "number" }]);
  });
});
