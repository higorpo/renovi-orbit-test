/**
 * NetCred enforces unique referenceCode per charge and expects a UUID.
 * After a REJECTED charge for contracted_service_id, manual retries must use a
 * distinct UUID or the gateway only reconciles the old rejection.
 *
 * Cron / first charge: payment_schedules.gateway_reference_code = contracted_service_id
 * Manual retry: RPC rotates gateway_reference_code to gen_random_uuid()
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
