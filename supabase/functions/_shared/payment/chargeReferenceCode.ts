/**
 * NetCred enforces unique referenceCode per charge and expects a UUID.
 * After a terminal REJECTED/VOIDED charge, manual retries rotate to a fresh
 * UUID only after getTransaction confirms the prior ref is safe to abandon.
 *
 * Cron / first charge: payment_schedules.gateway_reference_code = contracted_service_id
 * Manual retry: Edge rotates gateway_reference_code after reconcile (not in begin lease).
 */
export function resolveChargeReferenceCode(input: {
  gatewayReferenceCode?: string | null;
  contractedServiceId: string;
}): string {
  const fromSchedule = input.gatewayReferenceCode?.trim();
  if (fromSchedule) {
    return fromSchedule;
  }
  return input.contractedServiceId;
}
