import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "@/features/chats/constants/queryKeys";
import { useChatAnalytics } from "@/features/chats/hooks/useChatAnalytics";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  SERVICE_DETAIL_QUERY_KEY,
  SERVICES_LIST_QUERY_KEY,
} from "@/features/view-services";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import {
  acceptProposalWithPayment,
  rejectProposal,
  requestProposalRevision,
} from "../api/proposals.api";
import type {
  AcceptProposalMutationParams,
  AcceptProposalMutationResult,
  ProposalRevisionReason,
} from "../types/proposals.types";
import type { ProposalsApiError } from "../types/proposals.types";
import { getClientIpBestEffort } from "@/lib/getClientIp";

const OFFLINE_MESSAGE =
  "Você está offline. Conecte-se à internet para aceitar a proposta.";

function invalidateChatQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string | null,
) {
  if (!chatId) return;

  void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CONVERSATION_DETAIL_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
}

function invalidateAfterAccept(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string | null,
  serviceRequestId: string | null,
) {
  invalidateChatQueries(queryClient, chatId);
  void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
  if (serviceRequestId) {
    void queryClient.invalidateQueries({
      queryKey: [...SERVICE_DETAIL_QUERY_KEY, serviceRequestId],
    });
    void queryClient.invalidateQueries({
      queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
    });
  }
}

function handleMutationError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "OFFLINE") {
    toast.error(OFFLINE_MESSAGE);
    return;
  }
  const apiError = error as ProposalsApiError;
  if (apiError?.message) {
    toast.error(apiError.message);
    return;
  }
  toast.error(fallback);
}

export function useAcceptProposalMutation(
  chatId: string | null,
  serviceRequestId: string | null,
) {
  const queryClient = useQueryClient();
  const analytics = useChatAnalytics();
  const isOnline = useOnlineStatus();

  return useMutation<AcceptProposalMutationResult, Error, AcceptProposalMutationParams>({
    mutationFn: async (params) => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      const clientIp = params.clientIp !== undefined
        ? params.clientIp
        : await getClientIpBestEffort();

      const result = await acceptProposalWithPayment({
        proposalId: params.proposalId,
        selectedSlot: params.selectedSlot,
        idempotencyKey: params.idempotencyKey,
        clientCardTokenId: params.paymentTokenId,
        installmentNumber: params.installmentNumber,
        installmentSelectionHmac: params.installmentSelectionHmac,
        installmentHmacPayload: params.installmentHmacPayload,
        clearsaleSessionId: params.clearsaleSessionId,
        pricingSignature: params.pricingSignature,
        clientIp,
      });

      if (result.error || !result.data) {
        const error = new Error(result.error?.message ?? "accept_proposal_failed");
        if (result.error?.code && result.error.code !== "UNKNOWN") {
          (error as Error & { code?: string }).code = result.error.code;
        }
        if (result.error?.retryAfterSeconds != null) {
          (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
            result.error.retryAfterSeconds;
        }
        throw error;
      }

      return {
        contractedServiceId: result.data.service.id,
        scheduleId: result.data.payment_schedule?.id,
      };
    },
    onSuccess: (_data, variables) => {
      if (chatId && serviceRequestId) {
        analytics.proposal_accepted({
          proposal_id: variables.proposalId,
          chat_id: chatId,
          service_request_id: serviceRequestId,
        });
      }
      invalidateAfterAccept(queryClient, chatId, serviceRequestId);

      if (chatId) {
        toast.success("Proposta aceita com sucesso.");
      }
    },
    onError: (error) => handleMutationError(error, "Não foi possível aceitar a proposta."),
  });
}

export function useRejectProposalMutation(
  chatId: string | null,
  serviceRequestId: string | null,
) {
  const queryClient = useQueryClient();
  const analytics = useChatAnalytics();
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async (params: { proposalId: string; rejectionReason: string }) => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      const result = await rejectProposal(params);
      if (result.error || !result.data) {
        throw result.error ?? new Error("Não foi possível recusar a proposta.");
      }

      return result.data;
    },
    onSuccess: (_data, variables) => {
      if (chatId && serviceRequestId) {
        analytics.proposal_rejected({
          proposal_id: variables.proposalId,
          chat_id: chatId,
          service_request_id: serviceRequestId,
        });
      }
      invalidateChatQueries(queryClient, chatId);
      if (serviceRequestId) {
        void queryClient.invalidateQueries({
          queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
        });
      }
      toast.success("Proposta recusada.");
    },
    onError: (error) => handleMutationError(error, "Não foi possível recusar a proposta."),
  });
}

export function useRequestProposalRevisionMutation(
  chatId: string | null,
  serviceRequestId: string | null,
) {
  const queryClient = useQueryClient();
  const analytics = useChatAnalytics();
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async (params: {
      proposalId: string;
      revisionReason: ProposalRevisionReason;
      revisionNotes?: string;
    }) => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      const result = await requestProposalRevision(params);
      if (result.error || !result.data) {
        throw result.error ?? new Error("Não foi possível solicitar revisão.");
      }

      return result.data;
    },
    onSuccess: (_data, variables) => {
      if (chatId && serviceRequestId) {
        analytics.revision_requested({
          proposal_id: variables.proposalId,
          chat_id: chatId,
          service_request_id: serviceRequestId,
          revision_reason: variables.revisionReason,
        });
      }
      invalidateChatQueries(queryClient, chatId);
      if (serviceRequestId) {
        void queryClient.invalidateQueries({
          queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
        });
      }
      toast.success("Pedido de revisão enviado ao prestador.");
    },
    onError: (error) => handleMutationError(error, "Não foi possível solicitar revisão."),
  });
}
