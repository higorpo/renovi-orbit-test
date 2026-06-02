import { describe, expect, it } from "vitest";
import { generateIdempotencyKeyV7 } from "../idempotencyKey";

const UUID_V7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateIdempotencyKeyV7", () => {
  it("returns UUID v7 format", () => {
    const key = generateIdempotencyKeyV7();
    expect(key).toMatch(UUID_V7_RE);
  });

  it("generates unique keys", () => {
    const a = generateIdempotencyKeyV7();
    const b = generateIdempotencyKeyV7();
    expect(a).not.toBe(b);
  });
});
