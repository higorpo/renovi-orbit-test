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

  it("stays inactive when disabled or expiresAt is invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));

    const disabled = renderHook(() =>
      useProposalCountdown({
        status: "PENDING",
        expiresAt: "2026-01-02T12:00:00.000Z",
        enabled: false,
      }),
    );
    expect(disabled.result.current.phase).toBe("inactive");

    const invalid = renderHook(() =>
      useProposalCountdown({
        status: "PENDING",
        expiresAt: "bad-date",
      }),
    );
    expect(invalid.result.current.phase).toBe("inactive");
  });

  it("does not start an interval for non-pending statuses", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() =>
      useProposalCountdown({
        status: "ACCEPTED",
        expiresAt: "2026-01-02T12:00:00.000Z",
      }),
    );

    expect(result.current.phase).toBe("inactive");
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("starts an interval while a pending proposal has an expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { unmount } = renderHook(() =>
      useProposalCountdown({
        status: "PENDING",
        expiresAt: "2026-01-01T12:05:00.000Z",
        tickIntervalMs: 1_000,
      }),
    );

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1_000);
    unmount();
    setIntervalSpy.mockRestore();
  });
});
