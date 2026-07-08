import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type {
  ServiceRescheduleApiResult,
  ServiceRescheduleMutationResponse,
  ServiceRescheduleSlot,
  ServiceRescheduleSnapshot,
} from "../types/serviceReschedule.types";
import { mapServiceRescheduleRpcError } from "../utils/serviceRescheduleErrors";
import { mapRescheduleSnapshot } from "../utils/mapRescheduleSnapshot";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; details?: string } | null }>;
};

function getRpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

function isMutationResponse(value: unknown): value is ServiceRescheduleMutationResponse {
  return value !== null && typeof value === "object";
}

async function invokeRpc<T>(
  rpc: string,
  args: Record<string, unknown>,
  validate: (data: unknown) => data is T,
): Promise<ServiceRescheduleApiResult<T>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(rpc, args);

  if (error) {
    const mapped = mapServiceRescheduleRpcError(error);
    logger.error("service_reschedule_api_error", { rpc, code: mapped.code });
    return { data: null, error: mapped };
  }

  if (!validate(data)) {
    logger.error("service_reschedule_invalid_response", { rpc, data });
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

function normalizeMutationResponse(value: unknown): ServiceRescheduleMutationResponse {
  if (!value || typeof value !== "object") {
    return { reschedule: null };
  }

  const record = value as Record<string, unknown>;
  return {
    reschedule_request_id:
      typeof record.reschedule_request_id === "string" ? record.reschedule_request_id : undefined,
    chat_id: typeof record.chat_id === "string" ? record.chat_id : undefined,
    deep_link_path:
      typeof record.deep_link_path === "string" ? record.deep_link_path : undefined,
    reschedule: mapRescheduleSnapshot(record.reschedule),
  };
}

function isRescheduleSnapshotResponse(value: unknown): value is Record<string, unknown> {
  return mapRescheduleSnapshot(value) !== null;
}

export async function getServiceRescheduleRequest(
  rescheduleRequestId: string,
): Promise<ServiceRescheduleApiResult<ServiceRescheduleSnapshot>> {
  const result = await invokeRpc(
    "cns_get_service_reschedule_request",
    { p_reschedule_request_id: rescheduleRequestId },
    isRescheduleSnapshotResponse,
  );

  if (!result.data) {
    return { data: null, error: result.error };
  }

  const snapshot = mapRescheduleSnapshot(result.data);
  if (!snapshot) {
    return {
      data: null,
      error: { code: "UNKNOWN", message: "Resposta inesperada do servidor." },
    };
  }

  return { data: snapshot, error: null };
}

export async function requestServiceReschedule(params: {
  contractedServiceId: string;
  requestNote?: string | null;
  idempotencyKey?: string;
}): Promise<ServiceRescheduleApiResult<ServiceRescheduleMutationResponse>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokeRpc(
    "cns_request_service_reschedule",
    {
      p_contracted_service_id: params.contractedServiceId,
      p_idempotency_key: idempotencyKey,
      p_request_note: params.requestNote ?? null,
    },
    isMutationResponse,
  );

  if (!result.data) return result;
  return { data: normalizeMutationResponse(result.data), error: null };
}

export async function proposeServiceReschedule(params: {
  rescheduleRequestId: string;
  newSlot: ServiceRescheduleSlot;
  idempotencyKey?: string;
}): Promise<ServiceRescheduleApiResult<ServiceRescheduleMutationResponse>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokeRpc(
    "cns_propose_service_reschedule",
    {
      p_reschedule_request_id: params.rescheduleRequestId,
      p_new_slot: params.newSlot,
      p_idempotency_key: idempotencyKey,
    },
    isMutationResponse,
  );

  if (!result.data) return result;
  return { data: normalizeMutationResponse(result.data), error: null };
}

export async function acceptServiceReschedule(params: {
  rescheduleRequestId: string;
  idempotencyKey?: string;
}): Promise<ServiceRescheduleApiResult<ServiceRescheduleMutationResponse>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokeRpc(
    "cns_accept_service_reschedule",
    {
      p_reschedule_request_id: params.rescheduleRequestId,
      p_idempotency_key: idempotencyKey,
    },
    isMutationResponse,
  );

  if (!result.data) return result;
  return { data: normalizeMutationResponse(result.data), error: null };
}

export async function requestRescheduleAdjustment(params: {
  rescheduleRequestId: string;
  idempotencyKey?: string;
}): Promise<ServiceRescheduleApiResult<ServiceRescheduleMutationResponse>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokeRpc(
    "cns_request_reschedule_adjustment",
    {
      p_reschedule_request_id: params.rescheduleRequestId,
      p_idempotency_key: idempotencyKey,
    },
    isMutationResponse,
  );

  if (!result.data) return result;
  return { data: normalizeMutationResponse(result.data), error: null };
}

export async function cancelServiceRescheduleRequest(params: {
  rescheduleRequestId: string;
  idempotencyKey?: string;
}): Promise<ServiceRescheduleApiResult<ServiceRescheduleMutationResponse>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  const result = await invokeRpc(
    "cns_cancel_service_reschedule_request",
    {
      p_reschedule_request_id: params.rescheduleRequestId,
      p_idempotency_key: idempotencyKey,
    },
    isMutationResponse,
  );

  if (!result.data) return result;
  return { data: normalizeMutationResponse(result.data), error: null };
}
