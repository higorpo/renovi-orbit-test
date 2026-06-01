// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProposalTimelineHydration } from "../useProposalTimelineHydration";

const getProposalForTimelineMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  getProposalForTimeline: (...args: unknown[]) => getProposalForTimelineMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getProposalForTimelineMock.mockResolvedValue({
    data: {
      proposal: {
        id: "prop-1",
        status: "PENDING",
        version: 1,
        original_amount: 100,
        final_amount: 110,
        description: "Escopo",
        proposal_duration_value: 2,
        proposal_duration_unit: "hours",
        proposal_suggested_slots: [],
        submitted_at: "2026-05-30T10:00:00.000Z",
        client_response_deadline_at: "2026-05-31T10:00:00.000Z",
      },
    },
    error: null,
  });
});

describe("useProposalTimelineHydration", () => {
  it("hydrates proposal card payload when enabled", async () => {
    const { result } = renderHook(
      () => useProposalTimelineHydration("chat-1", "prop-1", true),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getProposalForTimelineMock).toHaveBeenCalledWith({
      chatId: "chat-1",
      proposalId: "prop-1",
    });
    expect(result.current.proposal?.id).toBe("prop-1");
    expect(result.current.proposal?.status).toBe("PENDING");
  });

  it("skips fetch when disabled or proposal id missing", () => {
    renderHook(() => useProposalTimelineHydration("chat-1", null, true), {
      wrapper: createWrapper(),
    });
    renderHook(() => useProposalTimelineHydration("chat-1", "prop-1", false), {
      wrapper: createWrapper(),
    });

    expect(getProposalForTimelineMock).not.toHaveBeenCalled();
  });
});
