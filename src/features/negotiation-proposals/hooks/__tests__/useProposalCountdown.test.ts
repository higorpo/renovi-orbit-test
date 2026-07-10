// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProposalCountdown } from "../useProposalCountdown";

describe("useProposalCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses server expires_at for the countdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));

    const { result } = renderHook(() =>
      useProposalCountdown({
        status: "PENDING",
        expiresAt: "2026-01-02T12:00:00.000Z",
      }),
    );

    expect(result.current.phase).toBe("active");
    expect(result.current.expiresAt?.toISOString()).toBe("2026-01-02T12:00:00.000Z");
    expect(result.current.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
