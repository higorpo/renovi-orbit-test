import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ServiceRequestRow } from "@/features/request-quote/types/request-quote.types";
import type { StatusTabId } from "../constants/statusTabs";
import { statusTabIdToListPhase } from "../utils/serviceRequestListPhase";

/** Joined row: service_requests + address + platform_services + proposals + contracted service. */
export interface ServiceRequestWithRelationsRow extends ServiceRequestRow {
  client_addresses?: {
    neighborhood: string;
    street: string;
    number: string;
    complement?: string | null;
    zip_code?: string | null;
    platform_cities?: { name: string } | null;
    platform_states?: { abbreviation: string } | null;
  } | null;
  platform_services?: {
    title: string;
    slug: string;
    icon_key: string | null;
    color_key: string | null;
  } | null;
  provider_proposals?: { status: string }[] | null;
  services?: {
    id: string;
    status: string;
    provider?: {
      full_name: string | null;
      provider_profiles_public?: { display_name: string | null } | null;
    } | null;
  } | null;
}

export interface ListServiceRequestsParams {
  clientId: string;
  page: number;
  pageSize: number;
  statusTabId: StatusTabId;
  search?: string | null;
  categoryId?: string | null;
  cityName?: string | null;
  neighborhoodName?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  hasImages?: boolean | null;
  hasProposals?: boolean | null;
  serviceRequestId?: string | null;
}

export interface ListServiceRequestsResult {
  data: {
    items: ServiceRequestWithRelationsRow[];
    total_count: number;
    page: number;
    page_size: number;
  } | null;
  error: string | null;
}

/** PostgREST `or()` uses commas as clause separators; ILIKE treats `%` and `_` as wildcards. */
function sanitizeSearchForOrIlike(raw: string): string {
  const noComma = raw.replace(/,/g, " ");
  return noComma.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * List service requests for the given client.
 * RLS ensures only own rows are returned.
 */
export async function listServiceRequests(
  params: ListServiceRequestsParams,
): Promise<ListServiceRequestsResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const focusedServiceRequestId = params.serviceRequestId?.trim() ?? "";

  if (!focusedServiceRequestId && params.statusTabId === "dispute") {
    return {
      data: { items: [], total_count: 0, page, page_size: pageSize },
      error: null,
    };
  }

  const needsProposalIdFilter =
    !focusedServiceRequestId &&
    params.hasProposals !== null &&
    params.hasProposals !== undefined;

  let serviceRequestIdsWithProposals: string[] | null = null;

  if (needsProposalIdFilter) {
    const { data: proposalRows, error: proposalsError } = await supabase
      .from("provider_proposals")
      .select("service_request_id, service_requests!inner(client_id)")
      .eq("service_requests.client_id", params.clientId);

    if (proposalsError) {
      logger.error("view_service_requests_list_proposals_filter_error", {
        clientId: params.clientId,
        error: proposalsError.message,
      });
      return { data: null, error: proposalsError.message };
    }

    const ids = new Set<string>();
    (proposalRows ?? []).forEach((row) => {
      const proposal = row as { service_request_id?: string | null };
      if (proposal.service_request_id) ids.add(proposal.service_request_id);
    });
    serviceRequestIdsWithProposals = Array.from(ids);
  }

  let query = supabase
    .from("service_requests")
    .select(
      `
      *,
      client_addresses (
        neighborhood,
        street,
        number,
        complement,
        zip_code,
        platform_cities ( name ),
        platform_states ( abbreviation )
      ),
      platform_services ( title, slug, icon_key, color_key ),
      provider_proposals ( status ),
      services!service_requests_contracted_service_id_fkey (
        id,
        status,
        provider:profiles!services_provider_id_fkey (
          full_name,
          provider_profiles_public ( display_name )
        )
      )
    `,
      { count: "exact" },
    )
    .eq("client_id", params.clientId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (focusedServiceRequestId) {
    query = query.eq("id", focusedServiceRequestId);
  } else {
    const phase = statusTabIdToListPhase(params.statusTabId);
    if (phase === "negotiation") {
      query = query.eq("status", "OPEN").is("contracted_service_id", null);
    } else if (phase === "in_progress") {
      query = query.eq("status", "OPEN").not("contracted_service_id", "is", null);
    } else if (phase === "completed") {
      query = query.eq("status", "COMPLETED");
    } else if (phase === "cancelled") {
      query = query.eq("status", "CANCELLED");
    }

    const search = params.search?.trim();
    if (search) {
      const esc = sanitizeSearchForOrIlike(search);
      query = query.or(`title.ilike.%${esc}%,description.ilike.%${esc}%`);
    }

    if (params.categoryId?.trim()) {
      query = query.eq("platform_services.title", params.categoryId.trim());
    }

    if (params.cityName?.trim()) {
      query = query.eq("client_addresses.platform_cities.name", params.cityName.trim());
    }

    if (params.neighborhoodName?.trim()) {
      query = query.eq("client_addresses.neighborhood", params.neighborhoodName.trim());
    }

    if (params.dateFrom) {
      query = query.gte("created_at", `${params.dateFrom}T00:00:00`);
    }

    if (params.dateTo) {
      query = query.lte("created_at", `${params.dateTo}T23:59:59`);
    }

    if (params.hasImages === true) {
      query = query.not("photos", "is", null).not("photos", "eq", "{}");
    }

    if (params.hasImages === false) {
      query = query.or("photos.is.null,photos.eq.{}");
    }

    if (params.hasProposals === true) {
      if (!serviceRequestIdsWithProposals || serviceRequestIdsWithProposals.length === 0) {
        return {
          data: { items: [], total_count: 0, page, page_size: pageSize },
          error: null,
        };
      }
      query = query.in("id", serviceRequestIdsWithProposals);
    }

    if (params.hasProposals === false && serviceRequestIdsWithProposals?.length) {
      const excludedIds = serviceRequestIdsWithProposals
        .map((id) => `"${id}"`)
        .join(",");
      query = query.not("id", "in", `(${excludedIds})`);
    }
  }

  const { data, error, count } = await query.returns<ServiceRequestWithRelationsRow[]>();

  if (error) {
    logger.error("view_service_requests_list_error", {
      clientId: params.clientId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  return {
    data: {
      items: data ?? [],
      total_count: count ?? 0,
      page,
      page_size: pageSize,
    },
    error: null,
  };
}

export interface CancelServiceRequestParams {
  id: string;
  clientId: string;
}

export interface CancelServiceRequestResult {
  error: string | null;
}

/**
 * Cancel a service request (set status to CANCELLED).
 * Only allowed for the owning client. RLS enforces client_id match on update.
 */
export async function cancelServiceRequest(
  params: CancelServiceRequestParams,
): Promise<CancelServiceRequestResult> {
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid || uid !== params.clientId) {
    logger.warn("view_service_requests_cancel_unauthorized", {
      requestId: params.id,
      clientId: params.clientId,
    });
    return { error: "Não autorizado" };
  }

  const { error } = await supabase
    .from("service_requests")
    .update({ status: "CANCELLED" })
    .eq("id", params.id)
    .eq("client_id", params.clientId);

  if (error) {
    logger.error("view_service_requests_cancel_error", {
      requestId: params.id,
      clientId: params.clientId,
      error: error.message,
    });
    return { error: error.message };
  }

  return { error: null };
}
