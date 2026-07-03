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

const acceptProposalWithPaymentMock = vi.fn();
const rejectProposalMock = vi.fn();
const getClientIpBestEffortMock = vi.fn();

const { useOnlineStatusMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
}));

vi.mock("../../api/proposals.api", () => ({
  acceptProposalWithPayment: (...args: unknown[]) => acceptProposalWithPaymentMock(...args),
  rejectProposal: (...args: unknown[]) => rejectProposalMock(...args),
  requestProposalRevision: vi.fn(),
}));

vi.mock("@/lib/getClientIp", () => ({
  getClientIpBestEffort: (...args: unknown[]) => getClientIpBestEffortMock(...args),
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

const paymentParams = {
  paymentTokenId: "token-1",
  installmentNumber: 1,
  installmentSelectionHmac: "deadbeef",
  installmentHmacPayload: { proposal_id: "prop-1" },
  clearsaleSessionId: "clearsale-session",
  pricingSignature: "pricing-sig",
  idempotencyKey: "idem-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  useOnlineStatusMock.mockReturnValue(true);
  getClientIpBestEffortMock.mockResolvedValue("203.0.113.1");
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
        ...paymentParams,
      }),
    ).rejects.toThrow("OFFLINE");

    expect(acceptProposalWithPaymentMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Você está offline. Conecte-se à internet para aceitar a proposta.",
      ),
    );
  });

  it("surfaces 429 retry metadata from accept API errors", async () => {
    useOnlineStatusMock.mockReturnValue(true);

    acceptProposalWithPaymentMock.mockResolvedValue({
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
        ...paymentParams,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 30 });

    expect(toast.error).toHaveBeenCalledWith("Aguarde antes de tentar novamente.");
  });

  it("accepts with payment and maps contractedServiceId", async () => {
    acceptProposalWithPaymentMock.mockResolvedValue({
      data: {
        service: { id: "cs-1" },
        payment_schedule: { id: "sched-1" },
      },
      error: null,
    });

    const { result } = renderHook(
      () => useAcceptProposalMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    const response = await result.current.mutateAsync({
      proposalId: "prop-1",
      selectedSlot: { start_date: "2026-06-01", shift: "morning" },
      ...paymentParams,
    });

    expect(response).toEqual({
      contractedServiceId: "cs-1",
      scheduleId: "sched-1",
    });
    expect(acceptProposalWithPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "prop-1",
        clientCardTokenId: "token-1",
        clientIp: "203.0.113.1",
      }),
    );
  });

  it("propagates INSTALLMENT_SIGNATURE_EXPIRED from payment accept", async () => {
    acceptProposalWithPaymentMock.mockResolvedValue({
      data: null,
      error: {
        code: "INSTALLMENT_SIGNATURE_EXPIRED",
        message: "Assinatura expirada",
      },
    });

    const { result } = renderHook(
      () => useAcceptProposalMutation(null, null),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        selectedSlot: { start_date: "2026-06-01", shift: "morning" },
        ...paymentParams,
      }),
    ).rejects.toMatchObject({
      message: "Assinatura expirada",
      code: "INSTALLMENT_SIGNATURE_EXPIRED",
    });
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
