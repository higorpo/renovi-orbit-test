// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  useAcceptProposalMutation,
  useRejectProposalMutation,
  useRequestProposalRevisionMutation,
} from "../useProposalClientMutations";

const acceptProposalWithPaymentMock = vi.fn();
const rejectProposalMock = vi.fn();
const requestProposalRevisionMock = vi.fn();
const getClientIpBestEffortMock = vi.fn();

const {
  proposalAcceptedMock,
  proposalRejectedMock,
  revisionRequestedMock,
  useOnlineStatusMock,
} = vi.hoisted(() => ({
  proposalAcceptedMock: vi.fn(),
  proposalRejectedMock: vi.fn(),
  revisionRequestedMock: vi.fn(),
  useOnlineStatusMock: vi.fn(() => true),
}));

vi.mock("../../api/proposals.api", () => ({
  acceptProposalWithPayment: (...args: unknown[]) => acceptProposalWithPaymentMock(...args),
  rejectProposal: (...args: unknown[]) => rejectProposalMock(...args),
  requestProposalRevision: (...args: unknown[]) => requestProposalRevisionMock(...args),
}));

vi.mock("@/lib/getClientIp", () => ({
  getClientIpBestEffort: (...args: unknown[]) => getClientIpBestEffortMock(...args),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock("@/features/chats", () => ({
  useChatAnalytics: () => ({
    proposal_accepted: proposalAcceptedMock,
    proposal_rejected: proposalRejectedMock,
    revision_requested: revisionRequestedMock,
  }),
  CHAT_MESSAGES_QUERY_KEY: "chat-messages",
  CHAT_CONVERSATIONS_LIST_QUERY_KEY: "chat-conversations",
  CHAT_FREE_MESSAGING_QUERY_KEY: "chat-free-messaging",
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY: "chat-proposal-timeline",
  CONVERSATION_DETAIL_QUERY_KEY: "conversation-detail",
}));

vi.mock("@/features/chats/hooks/useChatAnalytics", () => ({
  useChatAnalytics: () => ({
    proposal_accepted: proposalAcceptedMock,
    proposal_rejected: proposalRejectedMock,
    revision_requested: revisionRequestedMock,
  }),
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
    await waitFor(() => {
      expect(proposalAcceptedMock).toHaveBeenCalledWith({
        proposal_id: "prop-1",
        chat_id: "chat-1",
        service_request_id: "sr-1",
      });
      expect(toast.success).toHaveBeenCalledWith("Proposta aceita com sucesso.");
    });
  });

  it("uses an explicit client IP and accepts a missing payment schedule", async () => {
    acceptProposalWithPaymentMock.mockResolvedValue({
      data: {
        service: { id: "cs-1" },
        payment_schedule: null,
      },
      error: null,
    });
    const { result } = renderHook(
      () => useAcceptProposalMutation(null, null),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        selectedSlot: { start_date: "2026-06-01", shift: "morning" },
        clientIp: "198.51.100.5",
        ...paymentParams,
      }),
    ).resolves.toEqual({ contractedServiceId: "cs-1", scheduleId: undefined });

    expect(getClientIpBestEffortMock).not.toHaveBeenCalled();
    expect(acceptProposalWithPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ clientIp: "198.51.100.5" }),
    );
    expect(proposalAcceptedMock).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
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

  it("rejects a proposal and tracks success", async () => {
    rejectProposalMock.mockResolvedValue({
      data: { id: "prop-1", status: "REJECTED" },
      error: null,
    });
    const { result } = renderHook(
      () => useRejectProposalMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        rejectionReason: "Prazo incompatível",
      }),
    ).resolves.toMatchObject({ status: "REJECTED" });

    await waitFor(() => {
      expect(proposalRejectedMock).toHaveBeenCalledWith({
        proposal_id: "prop-1",
        chat_id: "chat-1",
        service_request_id: "sr-1",
      });
      expect(toast.success).toHaveBeenCalledWith("Proposta recusada.");
    });
  });

  it("shows the API message when rejecting fails", async () => {
    rejectProposalMock.mockResolvedValue({
      data: null,
      error: { message: "A proposta já foi encerrada." },
    });
    const { result } = renderHook(
      () => useRejectProposalMutation(null, null),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        rejectionReason: "Outro motivo",
      }),
    ).rejects.toMatchObject({ message: "A proposta já foi encerrada." });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("A proposta já foi encerrada."),
    );
  });

  it("blocks revision requests when offline", async () => {
    useOnlineStatusMock.mockReturnValue(false);
    const { result } = renderHook(
      () => useRequestProposalRevisionMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        revisionReason: "OTHER",
      }),
    ).rejects.toThrow("OFFLINE");

    expect(requestProposalRevisionMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Você está offline. Conecte-se à internet para aceitar a proposta.",
      ),
    );
  });

  it("requests a proposal revision and tracks success", async () => {
    requestProposalRevisionMock.mockResolvedValue({
      data: { id: "prop-1", status: "REVISION_REQUESTED" },
      error: null,
    });
    const { result } = renderHook(
      () => useRequestProposalRevisionMutation("chat-1", "sr-1"),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        revisionReason: "OTHER",
        revisionNotes: "Preciso de outra data",
      }),
    ).resolves.toMatchObject({ status: "REVISION_REQUESTED" });

    await waitFor(() => {
      expect(revisionRequestedMock).toHaveBeenCalledWith({
        proposal_id: "prop-1",
        chat_id: "chat-1",
        service_request_id: "sr-1",
        revision_reason: "OTHER",
      });
      expect(toast.success).toHaveBeenCalledWith(
        "Pedido de revisão enviado ao prestador.",
      );
    });
  });

  it("uses the revision fallback when the API returns no result", async () => {
    requestProposalRevisionMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(
      () => useRequestProposalRevisionMutation(null, null),
      { wrapper: createWrapper() },
    );

    await expect(
      result.current.mutateAsync({
        proposalId: "prop-1",
        revisionReason: "OTHER",
      }),
    ).rejects.toThrow("Não foi possível solicitar revisão.");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não foi possível solicitar revisão.",
      ),
    );
  });
});
