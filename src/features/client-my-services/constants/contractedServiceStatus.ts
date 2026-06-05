/** Mirrors public.contracted_service_status enum values used by client-my-services filters. */
export const CONTRACTED_SERVICE_COMPLETED_STATUS = "COMPLETED" as const;
export const CONTRACTED_SERVICE_CANCELLED_STATUS = "CANCELLED" as const;

export function normalizeContractedServiceStatus(
  status: string | null | undefined,
): string {
  return (status ?? "").trim().toUpperCase();
}

export function isContractedServiceCompleted(
  status: string | null | undefined,
): boolean {
  return normalizeContractedServiceStatus(status) === CONTRACTED_SERVICE_COMPLETED_STATUS;
}

export function isContractedServiceCancelled(
  status: string | null | undefined,
): boolean {
  return normalizeContractedServiceStatus(status) === CONTRACTED_SERVICE_CANCELLED_STATUS;
}

export function extractContractedServiceStatus(
  services: { status?: string | null } | Array<{ status?: string | null }> | null | undefined,
): string | null {
  if (!services) return null;
  if (Array.isArray(services)) return services[0]?.status ?? null;
  return services.status ?? null;
}
