import { describe, expect, it, vi } from "vitest";
import { generateClearSaleSessionId } from "../generateClearSaleSessionId";

describe("generateClearSaleSessionId", () => {
  it("returns a UUID from crypto.randomUUID", () => {
    const uuid = "11111111-2222-4333-8444-555555555555";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(uuid);

    expect(generateClearSaleSessionId()).toBe(uuid);
  });
});
