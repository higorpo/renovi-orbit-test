import { generateIdempotencyKeyV7 } from "@/features/notifications";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import type {
  AcceptProposalResult,
  ProposalMutationResult,
  ProposalRevisionReason,
  ProposalsApiResult,
  ProposalSuggestedSlotRpc,
  ProposalVersionListResponse,
  SubmitProposalResult,
} from "../types/proposals.types";
import { mapProposalRpcError } from "../utils/proposalApiErrors";
import { CNS_PROPOSAL_RPC } from "./proposals.rpc";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; details?: string } | null }>;
};

function getRpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

function trackProposalApiError(rpc: string, code: string): void {
  logger.error("proposals_api_error", { rpc, code });
  metrics.count("proposals.api_error", 1, { rpc, code });
}

async function invokeRpc<T>(
  rpc: string,
  args: Record<string, unknown>,
  validate: (data: unknown) => data is T,
  invalidLogKey: string,
): Promise<ProposalsApiResult<T>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(rpc, args);

  if (error) {
    const mapped = mapProposalRpcError(error);
    trackProposalApiError(rpc, mapped.code);
    return { data: null, error: mapped };
  }

  if (!validate(data)) {
    logger.error(invalidLogKey, { rpc, data });
    trackProposalApiError(rpc, "INVALID_RESPONSE");
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: "Resposta inesperada do servidor.",
      },
    };
  }

  return { data, error: null };
}

function isSubmitProposalResult(value: unknown): value is SubmitProposalResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.proposal != null && typeof v.proposal === "object" && v.timeline_message != null;
}

function isAcceptProposalResult(value: unknown): value is AcceptProposalResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.service != null && v.proposal != null;
}

function isProposalMutationResult(value: unknown): value is ProposalMutationResult {
  if (!value || typeof value !== "object") return false;
  const proposal = (value as ProposalMutationResult).proposal;
  return proposal != null && typeof proposal.id === "string";
}

function isProposalVersionListResponse(value: unknown): value is ProposalVersionListResponse {
  if (!value || typeof value !== "object") return false;
  return Array.isArray((value as ProposalVersionListResponse).items);
}

export async function submitProposal(params: {
  chatId: string;
  idempotencyKey?: string;
  proposedAmount: number;
  proposalDescription: string;
  proposalDurationValue: number;
  proposalDurationUnit: string;
  proposalSuggestedSlots: ProposalSuggestedSlotRpc[];
  pricing: {
    pricingSignature: string;
    taxRate: number;
    taxAmount: number;
    finalAmount: number;
  };
  photos?: string[];
}): Promise<ProposalsApiResult<SubmitProposalResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.submitProposal,
    {
      p_chat_id: params.chatId,
      p_idempotency_key: idempotencyKey,
      p_proposed_amount: params.proposedAmount,
      p_proposal_description: params.proposalDescription,
      p_proposal_duration_value: params.proposalDurationValue,
      p_proposal_duration_unit: params.proposalDurationUnit,
      p_proposal_suggested_slots: params.proposalSuggestedSlots,
      p_pricing_signature: params.pricing.pricingSignature,
      p_tax_rate: params.pricing.taxRate,
      p_tax_amount: params.pricing.taxAmount,
      p_final_amount: params.pricing.finalAmount,
      p_photos: params.photos ?? [],
    },
    isSubmitProposalResult,
    "proposals_submit_invalid_response",
  );
}

export async function acceptProposal(params: {
  proposalId: string;
  selectedSlot: ProposalSuggestedSlotRpc;
  idempotencyKey?: string;
}): Promise<ProposalsApiResult<AcceptProposalResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.acceptProposal,
    {
      p_proposal_id: params.proposalId,
      p_selected_slot: params.selectedSlot,
      p_idempotency_key: idempotencyKey,
    },
    isAcceptProposalResult,
    "proposals_accept_invalid_response",
  );
}

export async function rejectProposal(params: {
  proposalId: string;
  rejectionReason: string;
  idempotencyKey?: string;
}): Promise<ProposalsApiResult<ProposalMutationResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.rejectProposal,
    {
      p_proposal_id: params.proposalId,
      p_rejection_reason: params.rejectionReason,
      p_idempotency_key: idempotencyKey,
    },
    isProposalMutationResult,
    "proposals_reject_invalid_response",
  );
}

export async function requestProposalRevision(params: {
  proposalId: string;
  revisionReason: ProposalRevisionReason;
  revisionNotes?: string;
  idempotencyKey?: string;
}): Promise<ProposalsApiResult<ProposalMutationResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.requestRevision,
    {
      p_proposal_id: params.proposalId,
      p_revision_reason: params.revisionReason,
      p_revision_notes: params.revisionNotes ?? null,
      p_idempotency_key: idempotencyKey,
    },
    isProposalMutationResult,
    "proposals_request_revision_invalid_response",
  );
}

export async function declineRevisionRequest(params: {
  proposalId: string;
  idempotencyKey?: string;
}): Promise<ProposalsApiResult<ProposalMutationResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.declineRevision,
    {
      p_proposal_id: params.proposalId,
      p_idempotency_key: idempotencyKey,
    },
    isProposalMutationResult,
    "proposals_decline_revision_invalid_response",
  );
}

export async function listProposalVersions(
  chatId: string,
): Promise<ProposalsApiResult<ProposalVersionListResponse>> {
  return invokeRpc(
    CNS_PROPOSAL_RPC.listProposalVersions,
    { p_chat_id: chatId },
    isProposalVersionListResponse,
    "proposals_list_versions_invalid_response",
  );
}

export const proposalsApi = {
  submitProposal,
  acceptProposal,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
};
