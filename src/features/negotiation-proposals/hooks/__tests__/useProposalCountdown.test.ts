// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProposalCountdown } from "../useProposalCountdown";

vi.mock("../../api/platformConstants.api", () => ({
  getProposalResponseSlaHours: vi.fn().mockResolvedValue(24),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useProposalCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes expiry from submitted_at plus platform SLA hours", async () => {
    const submittedAt = new Date(Date.now() - 60_000).toISOString();

    const { result } = renderHook(
      () =>
        useProposalCountdown({
          status: "PENDING",
          submittedAt,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.slaHours).toBe(24);
    });

    expect(result.current.phase).toBe("active");
    expect(result.current.expiresAt).not.toBeNull();
    expect(result.current.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});
