import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ServiceRequestRow } from "@/features/request-quote/types/request-quote.types";
import type { StatusTabId } from "../constants/statusTabs";

/** Joined row: service_requests + client_addresses (with city/state) + platform_services. */
export interface ServiceRequestWithRelationsRow extends ServiceRequestRow {
  client_addresses?: {
    neighborhood: string;
    street: string;
    number: string;
    platform_cities?: { name: string } | null;
    platform_states?: { abbreviation: string } | null;
  } | null;
  platform_services?: { title: string; slug: string; icon_key: string | null; color_key: string | null } | null;
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

function getStatusFilterFromTab(tabId: StatusTabId): string | null | "__NO_STATUS__" {
  switch (tabId) {
    case "all":
      return null;
    case "waiting_proposals":
      return "open";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "closed";
    case "cancelled":
      return "cancelled";
    case "dispute":
      return "__NO_STATUS__";
    case "negotiation":
      return "open";
    default:
      return null;
  }
}

/**
 * List service requests for the given client.
 * RLS ensures only own rows are returned.
 * Joins address (neighborhood, city, state) and service (title, slug) for list/card display.
 */
export async function listServiceRequests(
  params: ListServiceRequestsParams
): Promise<ListServiceRequestsResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const focusedServiceRequestId = params.serviceRequestId?.trim() ?? "";

  if (
    !focusedServiceRequestId &&
    getStatusFilterFromTab(params.statusTabId) === "__NO_STATUS__"
  ) {
    return {
      data: { items: [], total_count: 0, page, page_size: pageSize },
      error: null,
    };
  }

  const needsSubmittedProposalsFilter =
    !focusedServiceRequestId &&
    (params.statusTabId === "waiting_proposals" ||
      params.statusTabId === "negotiation");

  let serviceRequestIdsWithProposals: string[] | null = null;
  let submittedServiceRequestIdsWithProposals: string[] | null = null;
  const needsAnyProposalsFilter =
    !focusedServiceRequestId &&
    params.hasProposals !== null &&
    params.hasProposals !== undefined;

  if (needsAnyProposalsFilter || needsSubmittedProposalsFilter) {
    const { data: proposalRows, error: proposalsError } = await supabase
      .from("provider_proposals")
      .select("service_request_id, status, service_requests!inner(client_id)")
      .eq("service_requests.client_id", params.clientId);

    if (proposalsError) {
      logger.error("view_service_requests_list_proposals_filter_error", {
        clientId: params.clientId,
        error: proposalsError.message,
      });
      return { data: null, error: proposalsError.message };
    }

    const ids = new Set<string>();
    const submittedIds = new Set<string>();
    (proposalRows ?? []).forEach((row) => {
      const proposal = row as {
        service_request_id?: string | null;
        status?: string | null;
      };
      const id = proposal.service_request_id;
      if (id) ids.add(id);
      if (id && proposal.status === "submitted") submittedIds.add(id);
    });
    serviceRequestIdsWithProposals = Array.from(ids);
    submittedServiceRequestIdsWithProposals = Array.from(submittedIds);
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
        platform_cities ( name ),
        platform_states ( abbreviation )
      ),
      platform_services ( title, slug, icon_key, color_key )
    `,
      { count: "exact" }
    )
    .eq("client_id", params.clientId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (focusedServiceRequestId) {
    query = query.eq("id", focusedServiceRequestId);
  } else {
    const statusFilter = getStatusFilterFromTab(params.statusTabId);
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const search = params.search?.trim();
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    if (params.categoryId?.trim()) {
      query = query.eq("platform_services.title", params.categoryId.trim());
    }

    if (params.cityName?.trim()) {
      query = query.eq("client_addresses.platform_cities.name", params.cityName.trim());
    }

    if (params.neighborhoodName?.trim()) {
      query = query.eq(
        "client_addresses.neighborhood",
        params.neighborhoodName.trim()
      );
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

    if (params.statusTabId === "negotiation") {
      if (
        !submittedServiceRequestIdsWithProposals ||
        submittedServiceRequestIdsWithProposals.length === 0
      ) {
        return {
          data: { items: [], total_count: 0, page, page_size: pageSize },
          error: null,
        };
      }
      query = query.in("id", submittedServiceRequestIdsWithProposals);
    }

    if (
      params.statusTabId === "waiting_proposals" &&
      submittedServiceRequestIdsWithProposals?.length
    ) {
      const excludedIds = submittedServiceRequestIdsWithProposals
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
