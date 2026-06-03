import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type {
  AcceptProposalResult,
  CreateProviderProposalParams,
  CreateProviderProposalResult,
  ProposalMutationResult,
  ProposalRevisionReason,
  ProposalsApiResult,
  ProviderProposalHistoryItem,
  ProposalSuggestedSlotRpc,
  ProposalVersionListResponse,
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

function isCreateProviderProposalResult(value: unknown): value is CreateProviderProposalResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.proposal != null &&
    typeof v.proposal === "object"
  );
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

const PROPOSAL_DETAIL_SELECT =
  "id, service_request_id, provider_id, status, version, revision_count, revision_reason, revision_notes, submitted_at, expired_at, proposed_amount, tax_rate, tax_amount, final_amount, proposal_description, proposal_duration_unit, proposal_duration_value, proposal_suggested_slots, photos, client_rejection_response, client_response_deadline_at, created_at, updated_at" as const;

function isProposalDetailRow(value: unknown): value is ProposalDetailView {
  if (!value || typeof value !== "object") return false;
  const row = value as ProposalDetailView;
  return typeof row.id === "string" && typeof row.service_request_id === "string";
}

export async function createProviderProposal(
  params: CreateProviderProposalParams,
): Promise<ProposalsApiResult<CreateProviderProposalResult>> {
  return invokeRpc(
    CNS_PROPOSAL_RPC.createProviderProposal,
    {
      p_service_request_id: params.serviceRequestId,
      p_proposed_amount: params.proposedAmount,
      p_proposal_description: params.proposalDescription,
      p_proposal_duration_value: params.proposalDurationValue,
      p_proposal_duration_unit: params.proposalDurationUnit,
      p_proposal_suggested_slots: params.proposalSuggestedSlots,
      p_photos: params.photos,
      p_tax_rate: params.pricing.tax_rate,
      p_tax_amount: params.pricing.tax_amount,
      p_final_amount: params.pricing.final_amount,
      p_pricing_signature: params.pricing.pricing_signature,
    },
    isCreateProviderProposalResult,
    "create_provider_proposal_invalid_response",
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

export async function getProposalDetail(
  proposalId: string,
): Promise<ProposalsApiResult<ProposalDetailView>> {
  const { data, error } = await supabase
    .from("provider_proposals")
    .select(PROPOSAL_DETAIL_SELECT)
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    logger.error("get_proposal_detail_error", {
      proposalId,
      error: error.message,
    });
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: error.message,
      },
    };
  }

  if (!data || !isProposalDetailRow(data)) {
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: "Proposta não encontrada.",
      },
    };
  }

  return { data, error: null };
}

export async function fetchProviderProposalHistory(
  serviceRequestId: string,
): Promise<{ data: ProviderProposalHistoryItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from("provider_proposals")
    .select(
      "id, proposed_amount, proposal_description, proposal_duration_value, proposal_duration_unit, proposal_suggested_slots, status, tax_rate, tax_amount, final_amount, photos, created_at, updated_at, client_rejection_response",
    )
    .eq("service_request_id", serviceRequestId)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("fetch_provider_proposal_history_error", {
      serviceRequestId,
      error: error.message,
    });
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as unknown as ProviderProposalHistoryItem[], error: null };
}

export const proposalsApi = {
  createProviderProposal,
  acceptProposal,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
  getProposalDetail,
  fetchProviderProposalHistory,
};
