import { describe, expect, it } from "vitest";
import { buildSystemPrompt, sourceEvent, validateChatRequest } from "../src/lib/chat";

describe("chat guardrails", () => {
  it("rejects malformed and oversized requests", () => {
    expect(validateChatRequest({ messages: [] })).toBeNull();
    expect(validateChatRequest({ messages: [{ role: "system", content: "no" }] })).toBeNull();
    expect(validateChatRequest({ messages: [{ role: "user", content: "x".repeat(6001) }] })).toBeNull();
  });

  it("builds a source-only prompt and SSE citation event", () => {
    const sources = [{ id: "s1", name: "QuantLib::Date", signature: "class Date", file: "ql/time/date.hpp", line: 125 }];
    expect(buildSystemPrompt(sources)).toContain("ONLY QuantForge APIs contained in the SOURCES");
    expect(sourceEvent(sources)).toContain("event: sources");
  });
});
