import type { SupabaseClient } from "@supabase/supabase-js";

export const SERVICE_LIST_DEEP_LINK_PATH = "/dashboard/services";

export function buildServiceDetailDeepLinkPath(serviceRequestId: string): string {
  return `${SERVICE_LIST_DEEP_LINK_PATH}/${serviceRequestId}`;
}

export function resolveServiceDeepLinkPath(
  serviceRequestId: string | null | undefined,
): string {
  if (serviceRequestId) {
    return buildServiceDetailDeepLinkPath(serviceRequestId);
  }

  return SERVICE_LIST_DEEP_LINK_PATH;
}

export async function enrichSchedulesWithServiceRequestIds<
  T extends { contracted_service_id: string },
>(
  supabase: Pick<SupabaseClient, "from">,
  schedules: T[],
): Promise<(T & { service_request_id: string | null })[]> {
  if (schedules.length === 0) {
    return [];
  }

  const contractedServiceIds = [
    ...new Set(schedules.map((schedule) => schedule.contracted_service_id)),
  ];
  const { data, error } = await supabase
    .from("contracted_services")
    .select("id, service_request_id")
    .in("id", contractedServiceIds);

  if (error || !data) {
    return schedules.map((schedule) => ({
      ...schedule,
      service_request_id: null,
    }));
  }

  const serviceRequestByContractedServiceId = new Map(
    data.map((row) => [
      String(row.id),
      row.service_request_id ? String(row.service_request_id) : null,
    ]),
  );

  return schedules.map((schedule) => ({
    ...schedule,
    service_request_id:
      serviceRequestByContractedServiceId.get(schedule.contracted_service_id) ?? null,
  }));
}
