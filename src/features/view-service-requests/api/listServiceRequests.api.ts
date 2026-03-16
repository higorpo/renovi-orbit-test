import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import type { ServiceRequestRow } from "@/features/request-quote/types/request-quote.types";

/** Joined row: service_requests + client_addresses (with city/state) + services. */
export interface ServiceRequestWithRelationsRow extends ServiceRequestRow {
  client_addresses?: {
    neighborhood: string;
    street: string;
    number: string;
    platform_cities?: { name: string } | null;
    platform_states?: { abbreviation: string } | null;
  } | null;
  services?: { title: string; slug: string; icon_key: string | null; color_key: string | null } | null;
}

export interface ListServiceRequestsParams {
  clientId: string;
  status?: string | null;
}

export interface ListServiceRequestsResult {
  data: ServiceRequestWithRelationsRow[] | null;
  error: string | null;
}

/**
 * List service requests for the given client.
 * RLS ensures only own rows are returned.
 * Joins address (neighborhood, city, state) and service (title, slug) for list/card display.
 */
export async function listServiceRequests(
  params: ListServiceRequestsParams
): Promise<ListServiceRequestsResult> {
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
      services ( title, slug, icon_key, color_key )
    `
    )
    .eq("client_id", params.clientId)
    .order("updated_at", { ascending: false });

  if (params.status != null && params.status !== "") {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query.returns<ServiceRequestWithRelationsRow[]>();

  if (error) {
    logger.error("view_service_requests_list_error", {
      clientId: params.clientId,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}
