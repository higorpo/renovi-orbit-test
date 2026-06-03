// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProposalTimelineHydration } from "../useProposalTimelineHydration";

const getProposalDetailMock = vi.fn();

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    getProposalDetail: (...args: unknown[]) => getProposalDetailMock(...args),
  };
});

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
  getProposalDetailMock.mockResolvedValue({
    data: {
      id: "prop-1",
      service_request_id: "sr-1",
      provider_id: "provider-1",
      status: "PENDING",
      version: 1,
      revision_count: 0,
      revision_reason: null,
      revision_notes: null,
      submitted_at: "2026-05-30T10:00:00.000Z",
      expired_at: null,
      proposed_amount: 100,
      tax_rate: 0,
      tax_amount: 0,
      final_amount: 110,
      proposal_description: "Escopo",
      proposal_duration_value: 2,
      proposal_duration_unit: "hours",
      proposal_suggested_slots: [],
      photos: [],
      client_rejection_response: null,
      client_response_deadline_at: "2026-05-31T10:00:00.000Z",
      created_at: "2026-05-30T10:00:00.000Z",
      updated_at: "2026-05-30T10:00:00.000Z",
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
    expect(getProposalDetailMock).toHaveBeenCalledWith("prop-1", "client");
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

    expect(getProposalDetailMock).not.toHaveBeenCalled();
  });
});
