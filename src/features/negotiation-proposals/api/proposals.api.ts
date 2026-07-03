import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import type { ProposalDetailAudience, ProposalDetailView } from "../types/proposalDetails.types";
import type {
  AcceptProposalResult,
  AcceptProposalWithPaymentParams,
  CreateProviderProposalParams,
  CreateProviderProposalResult,
  ProposalMutationResult,
  ProposalRevisionReason,
  ProposalsApiResult,
  ProviderProposalHistoryItem,
  ProposalVersionListResponse,
} from "../types/proposals.types";
import type {
  ProviderLatestProposal,
  ProviderLatestProposalRow,
} from "../types/serviceRequestProposal.types";
import { mapLatestProviderProposalRow } from "../utils/mapLatestProviderProposalRow";
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

const PROPOSAL_CLIENT_DETAIL_SELECT =
  "id, service_request_id, provider_id, status, version, revision_count, revision_reason, revision_notes, submitted_at, expired_at, proposed_amount, proposal_description, proposal_duration_unit, proposal_duration_value, proposal_suggested_slots, selected_slot, photos, client_rejection_response, created_at, updated_at" as const;

function isProposalDetailRow(value: unknown): value is ProposalDetailView {
  if (!value || typeof value !== "object") return false;
  const row = value as ProposalDetailView;
  return typeof row.id === "string" && typeof row.service_request_id === "string";
}

function isProposalDetailRowOrNull(value: unknown): value is ProposalDetailView | null {
  return value === null || isProposalDetailRow(value);
}

export async function createProviderProposal(
  params: CreateProviderProposalParams,
): Promise<ProposalsApiResult<CreateProviderProposalResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.createProviderProposal,
    {
      p_service_request_id: params.serviceRequestId,
      p_idempotency_key: idempotencyKey,
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

export async function acceptProposalWithPayment(
  params: AcceptProposalWithPaymentParams,
): Promise<ProposalsApiResult<AcceptProposalResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_PROPOSAL_RPC.acceptProposal,
    {
      p_proposal_id: params.proposalId,
      p_selected_slot: params.selectedSlot,
      p_idempotency_key: idempotencyKey,
      p_client_card_token_id: params.clientCardTokenId,
      p_installment_number: params.installmentNumber,
      p_installment_selection_hmac: params.installmentSelectionHmac,
      p_installment_hmac_payload: params.installmentHmacPayload,
      p_clearsale_session_id: params.clearsaleSessionId,
      p_pricing_signature: params.pricingSignature,
      p_client_ip: params.clientIp,
    },
    isAcceptProposalResult,
    "proposals_accept_with_payment_invalid_response",
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
  audience: ProposalDetailAudience = "provider",
): Promise<ProposalsApiResult<ProposalDetailView>> {
  if (audience === "provider") {
    const result = await invokeRpc<ProposalDetailView | null>(
      CNS_PROPOSAL_RPC.getProposalDetailForProvider,
      { p_proposal_id: proposalId },
      isProposalDetailRowOrNull,
      "get_proposal_detail_for_provider_invalid_response",
    );

    if (result.error) {
      return { data: null, error: result.error };
    }

    if (!result.data) {
      return {
        data: null,
        error: {
          code: "UNKNOWN",
          message: "Proposta não encontrada.",
        },
      };
    }

    return { data: result.data, error: null };
  }

  const { data, error } = await supabase
    .from("provider_proposals")
    .select(PROPOSAL_CLIENT_DETAIL_SELECT)
    .eq("id", proposalId)
    .maybeSingle();

  if (error) {
    logger.error("get_proposal_detail_error", {
      proposalId,
      audience,
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

const LATEST_PROVIDER_PROPOSAL_SELECT =
  "id, service_request_id, status, proposed_amount, tax_rate, tax_amount, proposal_description, photos, client_rejection_response, revision_reason, revision_notes, proposal_duration_value, proposal_duration_unit, proposal_suggested_slots, version";

function isProviderLatestProposalRow(value: unknown): value is ProviderLatestProposalRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.service_request_id === "string" &&
    typeof row.status === "string" &&
    typeof row.proposed_amount === "number" &&
    typeof row.proposal_description === "string"
  );
}

export async function getLatestProviderProposalForServiceRequest(params: {
  serviceRequestId: string;
  providerId: string;
}): Promise<{ data: ProviderLatestProposal | null; error: string | null }> {
  const { data, error } = await supabase
    .from("provider_proposals")
    .select(LATEST_PROVIDER_PROPOSAL_SELECT)
    .eq("service_request_id", params.serviceRequestId)
    .eq("provider_id", params.providerId)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("get_latest_provider_proposal_error", {
      serviceRequestId: params.serviceRequestId,
      providerId: params.providerId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data || !isProviderLatestProposalRow(data)) {
    return { data: null, error: null };
  }

  return { data: mapLatestProviderProposalRow(data), error: null };
}

export async function fetchProviderProposalHistory(
  serviceRequestId: string,
): Promise<{ data: ProviderProposalHistoryItem[]; error: string | null }> {
  const result = await invokeRpc(
    CNS_PROPOSAL_RPC.listProviderProposalHistory,
    { p_service_request_id: serviceRequestId },
    (value): value is { items: ProviderProposalHistoryItem[] } => {
      if (!value || typeof value !== "object") return false;
      return Array.isArray((value as { items: unknown }).items);
    },
    "list_provider_proposal_history_invalid_response",
  );

  if (result.error) {
    return { data: [], error: result.error.message };
  }

  return { data: result.data?.items ?? [], error: null };
}

export const proposalsApi = {
  createProviderProposal,
  acceptProposalWithPayment,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
  getProposalDetail,
  getLatestProviderProposalForServiceRequest,
  fetchProviderProposalHistory,
};
