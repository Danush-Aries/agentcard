import { describe, it, expect } from "vitest";
import {
  createAccumulator, foldRecord, finalize, longestStreak, projectName,
} from "../src/stats.js";

function assistant(usage: any, tools: string[] = [], extra: any = {}) {
  return {
    type: "assistant",
    ...extra,
    message: {
      role: "assistant",
      usage,
      content: tools.map((name) => ({ type: "tool_use", name, input: {} })),
    },
  };
}

describe("stats aggregation math", () => {
  it("sums token totals and computes billed", () => {
    const acc = createAccumulator();
    foldRecord(acc, assistant({ input_tokens: 100, output_tokens: 40, cache_read_input_tokens: 5, cache_creation_input_tokens: 7 }), "p", "s1");
    foldRecord(acc, assistant({ input_tokens: 200, output_tokens: 60 }), "p", "s1");
    const s = finalize(acc);
    expect(s.tokens.input).toBe(300);
    expect(s.tokens.output).toBe(100);
    expect(s.tokens.billed).toBe(400);
    expect(s.tokens.cacheRead).toBe(5);
    expect(s.tokens.cacheCreation).toBe(7);
  });

  it("counts tool usage and picks the top tool deterministically", () => {
    const acc = createAccumulator();
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, ["Edit", "Edit", "Bash"]), "p", "s1");
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, ["Read"]), "p", "s1");
    const s = finalize(acc);
    expect(s.toolUsage.Edit).toBe(2);
    expect(s.toolUsage.Bash).toBe(1);
    expect(s.toolTotal).toBe(4);
    expect(s.topTool?.name).toBe("Edit");
  });

  it("counts distinct sessions and projects, and finds the busiest project", () => {
    const acc = createAccumulator();
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, [], { sessionId: "a", cwd: "/x/alpha", timestamp: "2026-06-01T10:00:00Z" }), "fp", "fs");
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, [], { sessionId: "b", cwd: "/x/alpha", timestamp: "2026-06-02T10:00:00Z" }), "fp", "fs");
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, [], { sessionId: "c", cwd: "/x/beta", timestamp: "2026-06-03T10:00:00Z" }), "fp", "fs");
    const s = finalize(acc);
    expect(s.sessionCount).toBe(3);
    expect(s.projectCount).toBe(2);
    expect(s.busiestProject).toEqual({ name: "alpha", sessions: 2 });
  });

  it("tracks first/last activity and active days", () => {
    const acc = createAccumulator();
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, [], { timestamp: "2026-06-05T10:00:00Z" }), "p", "s1");
    foldRecord(acc, assistant({ input_tokens: 1, output_tokens: 1 }, [], { timestamp: "2026-06-01T08:00:00Z" }), "p", "s1");
    const s = finalize(acc);
    expect(s.firstActivity).toBe("2026-06-01T08:00:00.000Z");
    expect(s.lastActivity).toBe("2026-06-05T10:00:00.000Z");
    expect(s.activeDays).toBe(2);
  });

  it("ignores malformed / non-object records without throwing", () => {
    const acc = createAccumulator();
    expect(() => {
      foldRecord(acc, null, "p", "s");
      foldRecord(acc, 42, "p", "s");
      foldRecord(acc, "nope", "p", "s");
      foldRecord(acc, { type: "user" }, "p", "s");
      foldRecord(acc, { type: "assistant" }, "p", "s"); // no message
    }).not.toThrow();
    const s = finalize(acc);
    expect(s.tokens.billed).toBe(0);
    expect(s.messageCount).toBe(0);
  });

  it("clamps negative / non-numeric usage values to zero", () => {
    const acc = createAccumulator();
    foldRecord(acc, assistant({ input_tokens: -100, output_tokens: "lots" as any }), "p", "s");
    const s = finalize(acc);
    expect(s.tokens.billed).toBe(0);
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive-day run", () => {
    const days = new Set(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-08"]);
    expect(longestStreak(days)).toBe(3);
  });
  it("returns 0 for empty and 1 for a single day", () => {
    expect(longestStreak(new Set())).toBe(0);
    expect(longestStreak(new Set(["2026-06-01"]))).toBe(1);
  });
});

describe("projectName", () => {
  it("derives basename from a cwd", () => {
    expect(projectName("/Users/danu/Developer/agentcard")).toBe("agentcard");
    expect(projectName("")).toBeNull();
    expect(projectName(123)).toBeNull();
  });
});
