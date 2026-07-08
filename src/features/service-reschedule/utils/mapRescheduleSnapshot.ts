import type {
  ServiceRescheduleActiveRequest,
  ServiceRescheduleRequestedByRole,
  ServiceRescheduleRequestStatus,
  ServiceRescheduleSlot,
  ServiceRescheduleSnapshot,
} from "../types/serviceReschedule.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapSlot(value: unknown): ServiceRescheduleSlot | null {
  if (!isRecord(value)) return null;
  const shift = value.shift;
  const startDate = value.start_date;
  if (
    typeof startDate !== "string" ||
    (shift !== "morning" && shift !== "afternoon" && shift !== "full_day")
  ) {
    return null;
  }

  return {
    start_date: startDate,
    end_date: typeof value.end_date === "string" ? value.end_date : null,
    shift,
  };
}

function mapActiveRequest(value: unknown): ServiceRescheduleActiveRequest | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const originalSlot = mapSlot(value.original_slot);
  if (!originalSlot) return null;

  const requestedByRole = value.requested_by_role;
  if (requestedByRole !== "client" && requestedByRole !== "provider") return null;

  const status = value.status;
  if (typeof status !== "string") return null;

  return {
    id: value.id,
    status: status as ServiceRescheduleRequestStatus,
    requested_by_role: requestedByRole as ServiceRescheduleRequestedByRole,
    requested_by_profile_id: String(value.requested_by_profile_id ?? ""),
    request_note: typeof value.request_note === "string" ? value.request_note : null,
    original_slot: originalSlot,
    original_service_execution_at: String(value.original_service_execution_at ?? ""),
    proposed_slot: mapSlot(value.proposed_slot),
    proposed_at: typeof value.proposed_at === "string" ? value.proposed_at : null,
    adjustment_count: typeof value.adjustment_count === "number" ? value.adjustment_count : 0,
    is_last_minute: Boolean(value.is_last_minute),
    chat_id: String(value.chat_id ?? ""),
  };
}

export function mapRescheduleSnapshot(value: unknown): ServiceRescheduleSnapshot | null {
  if (!isRecord(value)) return null;

  const contractedServiceId = value.contracted_service_id;
  if (typeof contractedServiceId !== "string") return null;

  return {
    contractedServiceId,
    activeRequest: mapActiveRequest(value.active_request),
    displayStatus: typeof value.display_status === "string" ? value.display_status : null,
    canClientRequestReschedule: Boolean(value.can_client_request_reschedule),
    canProviderRequestReschedule: Boolean(value.can_provider_request_reschedule),
    canProposeReschedule: Boolean(value.can_propose_reschedule),
    canAcceptReschedule: Boolean(value.can_accept_reschedule),
    canRequestAdjustment: Boolean(value.can_request_adjustment),
    canCancelReschedule: Boolean(value.can_cancel_reschedule),
  };
}
