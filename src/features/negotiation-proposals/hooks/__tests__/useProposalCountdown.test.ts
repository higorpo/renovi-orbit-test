// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("uses client_response_deadline_at without fetching SLA", () => {
    const { result } = renderHook(
      () =>
        useProposalCountdown({
          status: "PENDING",
          submittedAt: "2026-01-01T00:00:00.000Z",
          clientResponseDeadlineAt: "2026-01-01T03:00:00.000Z",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.phase).toBe("warning");
    expect(result.current.slaHours).toBeNull();
  });
});
