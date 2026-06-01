// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  useAcceptProposalMutation,
  useRejectProposalMutation,
} from "../useProposalClientMutations";

const acceptProposalMock = vi.fn();
const rejectProposalMock = vi.fn();

const { useOnlineStatusMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
}));

vi.mock("../../api/proposals.api", () => ({
  acceptProposal: (...args: unknown[]) => acceptProposalMock(...args),
  rejectProposal: (...args: unknown[]) => rejectProposalMock(...args),
  requestProposalRevision: vi.fn(),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock("@/features/chats", () => ({
  useChatAnalytics: () => ({
    proposal_accepted: vi.fn(),
    proposal_rejected: vi.fn(),
    revision_requested: vi.fn(),
  }),
  CHAT_MESSAGES_QUERY_KEY: "chat-messages",
  CHAT_CONVERSATIONS_LIST_QUERY_KEY: "chat-conversations",
  CHAT_FREE_MESSAGING_QUERY_KEY: "chat-free-messaging",
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY: "chat-proposal-timeline",
  CONVERSATION_DETAIL_QUERY_KEY: "conversation-detail",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOnlineStatusMock.mockReturnValue(true);
});

describe("useProposalClientMutations", () => {
  it("blocks accept when offline", async () => {
    useOnlineStatusMock.mockReturnValue(false);

    const { result } = renderHook(
      () => useAcceptProposalMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        selectedSlot: { start_date: "2026-06-01", shift: "morning" },
      }),
    ).rejects.toThrow("OFFLINE");

    expect(acceptProposalMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Você está offline. Conecte-se à internet para aceitar a proposta.",
      ),
    );
  });

  it("surfaces 429 retry metadata from accept API errors", async () => {
    useOnlineStatusMock.mockReturnValue(true);

    acceptProposalMock.mockResolvedValue({
      data: null,
      error: {
        code: "RATE_LIMITED",
        message: "Aguarde antes de tentar novamente.",
        retryAfterSeconds: 30,
      },
    });

    const { result } = renderHook(
      () => useAcceptProposalMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        selectedSlot: { start_date: "2026-06-01", shift: "morning" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 30 });

    expect(toast.error).toHaveBeenCalledWith("Aguarde antes de tentar novamente.");
  });

  it("blocks reject when offline", async () => {
    useOnlineStatusMock.mockReturnValue(false);

    const { result } = renderHook(
      () => useRejectProposalMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        rejectionReason: "Não combina",
      }),
    ).rejects.toThrow("OFFLINE");

    expect(rejectProposalMock).not.toHaveBeenCalled();
  });
});
