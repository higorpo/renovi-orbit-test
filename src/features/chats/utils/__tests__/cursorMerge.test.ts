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

  it("preserves existing row reference when incoming row is unchanged", () => {
    const existingRow = {
      id: "img-1",
      chat_id: "chat-1",
      sender_user_id: "user-a",
      message_type: "IMAGE" as const,
      payload: { paths: ["chat/s/a.png"], preview: "Foto" },
      linked_entity_type: null,
      linked_entity_id: null,
      idempotency_key: "key-1",
      delivery_status: "SENT" as const,
      created_at: "2026-01-02T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };
    const existing = [existingRow];
    const incoming = [{ ...existingRow }];

    const merged = mergeKeysetMessagePages(existing, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(existingRow);
  });
});
