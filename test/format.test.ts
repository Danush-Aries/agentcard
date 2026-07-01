import { describe, it, expect } from "vitest";
import {
  humanNumber, withCommas, dayKey, escapeXml, shortToolName, prettyDate,
} from "../src/format.js";

describe("humanNumber", () => {
  it("passes through small numbers", () => {
    expect(humanNumber(0)).toBe("0");
    expect(humanNumber(999)).toBe("999");
  });
  it("formats thousands and millions", () => {
    expect(humanNumber(12500)).toBe("12.5K");
    expect(humanNumber(2_400_000)).toBe("2.4M");
    expect(humanNumber(1_000_000)).toBe("1M");
    expect(humanNumber(1_250_000_000)).toBe("1.3B");
  });
  it("is defensive about bad input", () => {
    expect(humanNumber(-5)).toBe("0");
    expect(humanNumber(NaN)).toBe("0");
  });
});

describe("withCommas", () => {
  it("groups thousands", () => {
    expect(withCommas(1234567)).toBe("1,234,567");
  });
});

describe("dayKey", () => {
  it("extracts UTC day", () => {
    expect(dayKey("2026-06-13T14:35:46.647Z")).toBe("2026-06-13");
  });
  it("returns null on garbage", () => {
    expect(dayKey("not-a-date")).toBeNull();
  });
});

describe("escapeXml", () => {
  it("escapes entities", () => {
    expect(escapeXml('a<b>&"c\'')).toBe("a&lt;b&gt;&amp;&quot;c&apos;");
  });
});

describe("shortToolName", () => {
  it("strips mcp prefixes to the leaf", () => {
    expect(shortToolName("mcp__playwright__browser_navigate")).toBe("browser_navigate");
    expect(shortToolName("Edit")).toBe("Edit");
  });
});

describe("prettyDate", () => {
  it("handles null", () => {
    expect(prettyDate(null)).toBe("—");
  });
});
