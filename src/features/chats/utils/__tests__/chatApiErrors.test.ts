import { describe, expect, it } from "vitest";
import { mapCnsRpcError } from "../chatApiErrors";

describe("mapCnsRpcError", () => {
  it("maps known code from message", () => {
    const error = mapCnsRpcError({ message: "NO_ACTIVE_SLOT" });
    expect(error.code).toBe("NO_ACTIVE_SLOT");
    expect(error.message).toContain("Limite");
  });

  it("reads retry_after_seconds from detail JSON", () => {
    const error = mapCnsRpcError({
      message: "RATE_LIMITED",
      details: '{"retry_after_seconds":15}',
    });
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(15);
  });
});
