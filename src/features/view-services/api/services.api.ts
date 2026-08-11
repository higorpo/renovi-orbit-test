import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { statusTabIdToListPhase } from "../constants/statusTabs";
import type { ListServicesParams, PaginatedServicesResult, ServiceModel } from "../types/service.types";
import type {
  ClientServiceJourney,
  ServiceJourneyMilestone,
  ServiceJourneyMilestoneKey,
  ServiceJourneyMilestoneRpc,
  ServiceJourneyMilestoneStatus,
} from "../types/serviceJourney.types";
import { SERVICE_JOURNEY_MILESTONE_KEYS } from "../constants/serviceJourney.constants";
import { mapRpcServiceRow, type RpcServiceRow } from "../utils/serviceMapper";

const MILESTONE_KEY_SET = new Set<string>(SERVICE_JOURNEY_MILESTONE_KEYS);
const MILESTONE_STATUS_SET = new Set<ServiceJourneyMilestoneStatus>([
  "completed",
  "current",
  "upcoming",
]);

function isServiceJourneyMilestoneKey(value: string): value is ServiceJourneyMilestoneKey {
  return MILESTONE_KEY_SET.has(value);
}

function isServiceJourneyMilestoneStatus(
  value: string,
): value is ServiceJourneyMilestoneStatus {
  return MILESTONE_STATUS_SET.has(value as ServiceJourneyMilestoneStatus);
}

function mapJourneyMilestone(
  raw: ServiceJourneyMilestoneRpc,
): ServiceJourneyMilestone | null {
  if (!isServiceJourneyMilestoneKey(raw.key)) return null;
  if (!isServiceJourneyMilestoneStatus(raw.status)) return null;
  return {
    key: raw.key,
    status: raw.status,
    occurredAt: typeof raw.occurred_at === "string" ? raw.occurred_at : null,
  };
}

function parseClientServiceJourney(data: unknown): ClientServiceJourney | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as { milestones?: unknown };
  if (!Array.isArray(payload.milestones)) return null;

  const milestones: ServiceJourneyMilestone[] = [];
  for (const item of payload.milestones) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const mapped = mapJourneyMilestone(item as ServiceJourneyMilestoneRpc);
    if (mapped) milestones.push(mapped);
  }

  return { milestones };
}

interface RpcListServicesResponse {
  items?: RpcServiceRow[];
  total_count?: number;
  page?: number;
  page_size?: number;
}

function parseRpcListResponse(data: unknown): PaginatedServicesResult | null {
  if (!data || typeof data !== "object") return null;
  const payload = data as RpcListServicesResponse;
  const items = Array.isArray(payload.items) ? payload.items.map(mapRpcServiceRow) : [];
  return {
    items,
    total_count: payload.total_count ?? items.length,
    page: payload.page ?? 1,
    page_size: payload.page_size ?? items.length,
  };
}

export async function getServiceById(
  serviceRequestId: string,
): Promise<{ data: ServiceModel | null; error: string | null }> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID do serviço é obrigatório" };
  }

  const { data, error } = await supabase.rpc("get_service", {
    p_service_request_id: id,
  });

  if (error) {
    logger.error("view_services_get_error", { serviceRequestId: id, error: error.message });
    return { data: null, error: error.message };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { data: null, error: null };
  }

  return { data: mapRpcServiceRow(data as unknown as RpcServiceRow), error: null };
}

export async function listServices(
  params: ListServicesParams,
): Promise<{ data: PaginatedServicesResult | null; error: string | null }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const focusedId = params.serviceRequestId?.trim() ?? "";

  if (focusedId) {
    const focused = await getServiceById(focusedId);
    if (focused.error) {
      return { data: null, error: focused.error };
    }
    return {
      data: {
        items: focused.data ? [focused.data] : [],
        total_count: focused.data ? 1 : 0,
        page: 1,
        page_size: pageSize,
      },
      error: null,
    };
  }

  const listPhase = statusTabIdToListPhase(params.statusTabId);

  const { data, error } = await supabase.rpc("list_services", {
    p_page: page,
    p_page_size: pageSize,
    p_list_phase: listPhase ?? undefined,
    p_search: params.search?.trim() || undefined,
    p_category_title: params.categoryId?.trim() || undefined,
    p_city_name: params.cityName?.trim() || undefined,
    p_neighborhood: params.neighborhoodName?.trim() || undefined,
    p_date_from: params.dateFrom || undefined,
    p_date_to: params.dateTo || undefined,
    p_has_images: params.hasImages ?? undefined,
    p_has_proposals: params.hasProposals ?? undefined,
  });

  if (error) {
    logger.error("view_services_list_error", { error: error.message });
    return { data: null, error: error.message };
  }

  const parsed = parseRpcListResponse(data);
  if (!parsed) {
    return { data: null, error: "Resposta inválida do servidor" };
  }

  return { data: parsed, error: null };
}

export async function cancelService(
  serviceRequestId: string,
): Promise<{ error: string | null }> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { error: "ID do serviço é obrigatório" };
  }

  const { error } = await supabase.rpc("cancel_service_request", {
    p_service_request_id: id,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) {
    logger.error("view_services_cancel_error", { serviceRequestId: id, error: error.message });
    return { error: error.message };
  }

  return { error: null };
}

export interface RepublishCancelledServiceResult {
  requestId: string;
  sourceRequestId: string;
}

export async function republishCancelledServiceRequest(
  serviceRequestId: string,
  idempotencyKey: string,
): Promise<{ data: RepublishCancelledServiceResult | null; error: string | null }> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID do serviço é obrigatório" };
  }
  if (!idempotencyKey.trim()) {
    return { data: null, error: "Chave de idempotência é obrigatória" };
  }

  const { data, error } = await supabase.rpc("republish_cancelled_service_request", {
    p_service_request_id: id,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    logger.error("view_services_republish_error", {
      serviceRequestId: id,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { data: null, error: "Resposta inválida do servidor" };
  }

  const payload = data as Record<string, unknown>;
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  const sourceRequestId =
    typeof payload.sourceRequestId === "string" ? payload.sourceRequestId : id;

  if (!requestId) {
    return { data: null, error: "Resposta inválida do servidor" };
  }

  return { data: { requestId, sourceRequestId }, error: null };
}

export async function getClientServiceJourney(
  serviceRequestId: string,
): Promise<{ data: ClientServiceJourney | null; error: string | null }> {
  const id = serviceRequestId.trim();
  if (!id) {
    return { data: null, error: "ID do serviço é obrigatório" };
  }

  const { data, error } = await supabase.rpc("get_client_service_journey", {
    p_service_request_id: id,
  });

  if (error) {
    logger.error("view_services_journey_error", {
      serviceRequestId: id,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  const parsed = parseClientServiceJourney(data);
  if (!parsed) {
    return { data: null, error: "Resposta inválida do servidor" };
  }

  return { data: parsed, error: null };
}
