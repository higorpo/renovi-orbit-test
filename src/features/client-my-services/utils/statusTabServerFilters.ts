import {
  CONTRACTED_SERVICE_CANCELLED_STATUS,
  CONTRACTED_SERVICE_COMPLETED_STATUS,
} from "../constants/contractedServiceStatus";
import type { ServiceRequestListPhase } from "./serviceRequestListPhase";

const CONTRACTED_SERVICE_FK = "service_requests_contracted_service_id_fkey";

/** Inner join is required so PostgREST filters on services.status exclude parent rows. */
export function shouldUseContractedServiceInnerJoin(
  phase: ServiceRequestListPhase | null,
): boolean {
  return phase === "in_progress" || phase === "completed";
}

export function buildContractedServiceEmbed(phase: ServiceRequestListPhase | null): string {
  const relation = shouldUseContractedServiceInnerJoin(phase)
    ? `services!inner!${CONTRACTED_SERVICE_FK}`
    : `services!${CONTRACTED_SERVICE_FK}`;

  return `${relation} (
        id,
        status,
        provider:profiles!services_provider_id_fkey (
          full_name,
          provider_profiles_public ( display_name )
        )
      )`;
}

export function buildServiceRequestsSelect(phase: ServiceRequestListPhase | null): string {
  return `
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
      ${buildContractedServiceEmbed(phase)}
    `;
}

export interface StatusTabFilterableQuery {
  eq(column: string, value: string): StatusTabFilterableQuery;
  neq(column: string, value: string): StatusTabFilterableQuery;
  or(filters: string): StatusTabFilterableQuery;
}

export function applyStatusTabServerFilter<T extends StatusTabFilterableQuery>(
  query: T,
  phase: ServiceRequestListPhase | null,
): T {
  if (!phase) return query;

  switch (phase) {
    case "negotiation":
      return query.eq("status", "OPEN");
    case "in_progress":
      return query
        .eq("status", "COMPLETED")
        .neq("services.status", CONTRACTED_SERVICE_COMPLETED_STATUS)
        .neq("services.status", CONTRACTED_SERVICE_CANCELLED_STATUS);
    case "completed":
      return query
        .eq("status", "COMPLETED")
        .eq("services.status", CONTRACTED_SERVICE_COMPLETED_STATUS);
    case "cancelled":
      // Cancelled tab ids are resolved via client_my_services_cancelled_ids RPC (see serviceRequests.api).
      return query;
    default:
      return query;
  }
}
