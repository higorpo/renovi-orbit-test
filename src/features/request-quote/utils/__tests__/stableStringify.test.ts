import { describe, it, expect } from "vitest";
import { stableStringify } from "../stableStringify";

describe("stableStringify", () => {
  it("returns same string for primitives as JSON.stringify", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(0)).toBe("0");
    expect(stableStringify(1)).toBe("1");
    expect(stableStringify(true)).toBe("true");
    expect(stableStringify(false)).toBe("false");
    expect(stableStringify("")).toBe('""');
    expect(stableStringify("a")).toBe('"a"');
  });

  it("stringifies arrays recursively", () => {
    expect(stableStringify([])).toBe("[]");
    expect(stableStringify([1, 2])).toBe("[1,2]");
    expect(stableStringify([null, "x"])).toBe('[null,"x"]');
  });

  it("stringifies objects with keys in sorted order", () => {
    expect(stableStringify({})).toBe("{}");
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  it("produces same output regardless of key order", () => {
    const a = stableStringify({ foo: 1, bar: 2 });
    const b = stableStringify({ bar: 2, foo: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"bar":2,"foo":1}');
  });

  it("handles nested objects with stable key order", () => {
    const obj = { c: { z: 1, a: 2 }, b: 3 };
    expect(stableStringify(obj)).toBe('{"b":3,"c":{"a":2,"z":1}}');
  });

  it("handles nested arrays", () => {
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("handles deep nesting", () => {
    const value = { x: [{ m: 2, n: 1 }] };
    expect(stableStringify(value)).toBe('{"x":[{"m":2,"n":1}]}');
  });
});
