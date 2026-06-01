import { describe, expect, it } from "vitest";
import { mergeKeysetMessagePages } from "../cursorMerge";

describe("mergeKeysetMessagePages", () => {
  it("dedupes by id and sorts ascending by created_at then id", () => {
    const existing = [
      { id: "b", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
    ];
    const incoming = [
      { id: "b", created_at: "2026-01-02T00:00:01.000Z" },
      { id: "c", created_at: "2026-01-03T00:00:00.000Z" },
    ];

    expect(mergeKeysetMessagePages(existing, incoming)).toEqual([
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-01-02T00:00:01.000Z" },
      { id: "c", created_at: "2026-01-03T00:00:00.000Z" },
    ]);
  });

  it("dedupes incoming when existing is empty", () => {
    const incoming = [
      { id: "b", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-01-02T00:00:01.000Z" },
    ];

    expect(mergeKeysetMessagePages([], incoming)).toEqual([
      { id: "a", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "b", created_at: "2026-01-02T00:00:01.000Z" },
    ]);
  });

  it("returns a copy of existing when incoming is empty", () => {
    const existing = [{ id: "a", created_at: "2026-01-01T00:00:00.000Z" }];
    const merged = mergeKeysetMessagePages(existing, []);
    expect(merged).toEqual(existing);
    expect(merged).not.toBe(existing);
  });
});
