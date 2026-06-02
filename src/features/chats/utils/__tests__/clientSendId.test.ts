import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: vi.fn(() => "019302a0-0000-7000-8000-000000000001"),
}));

import { createClientSendId } from "../clientSendId";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";

describe("createClientSendId", () => {
  it("delegates to generateIdempotencyKeyV7 (works without crypto.randomUUID)", () => {
    const id = createClientSendId();
    expect(generateIdempotencyKeyV7).toHaveBeenCalled();
    expect(id).toBe("019302a0-0000-7000-8000-000000000001");
  });
});
