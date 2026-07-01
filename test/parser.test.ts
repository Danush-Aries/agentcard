import { describe, it, expect } from "vitest";
import { parseLine, decodeProjectDir } from "../src/parser.js";

describe("parseLine — resilience / fuzz", () => {
  it("parses a valid object", () => {
    expect(parseLine('{"a":1}')).toEqual({ a: 1 });
  });
  it("returns null for blank / whitespace", () => {
    expect(parseLine("")).toBeNull();
    expect(parseLine("   \t  ")).toBeNull();
  });
  it("returns null for truncated / malformed JSON", () => {
    expect(parseLine('{"type":"assistant","message":{"usage":{"input')).toBeNull();
    expect(parseLine("not json at all")).toBeNull();
    expect(parseLine("{oops}")).toBeNull();
  });
  it("ignores bare primitives (non object/array)", () => {
    expect(parseLine("12345")).toBeNull();
    expect(parseLine('"a string"')).toBeNull();
  });
  it("parses arrays", () => {
    expect(parseLine("[1,2,3]")).toEqual([1, 2, 3]);
  });
  it("rejects pathologically huge lines instead of choking", () => {
    const huge = '{"x":"' + "a".repeat(50) + '"}';
    expect(parseLine(huge, 10)).toBeNull(); // over the tiny cap
    expect(parseLine('{"x":1}', 10)).toEqual({ x: 1 }); // under the cap
  });
  it("never throws on random bytes", () => {
    const inputs = [" ", "{".repeat(1000), "}}}}}", "{'single':1}", "{\n\n"];
    for (const i of inputs) {
      expect(() => parseLine(i)).not.toThrow();
    }
  });
});

describe("decodeProjectDir", () => {
  it("recovers the last path segment", () => {
    expect(decodeProjectDir("/x/-Users-danu-Desktop-Pentesting")).toBe("Pentesting");
  });
});
