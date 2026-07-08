export type ServiceRescheduleRequestStatus =
  | "REQUESTED"
  | "PROPOSED"
  | "ADJUSTMENT_REQUESTED"
  | "ACCEPTED"
  | "CANCELLED"
  | "EXPIRED";

export type ServiceRescheduleRequestedByRole = "client" | "provider";

export interface ServiceRescheduleSlot {
  start_date: string;
  end_date?: string | null;
  shift: "morning" | "afternoon" | "full_day";
}

export interface ServiceRescheduleActiveRequest {
  id: string;
  status: ServiceRescheduleRequestStatus;
  requested_by_role: ServiceRescheduleRequestedByRole;
  requested_by_profile_id: string;
  request_note: string | null;
  original_slot: ServiceRescheduleSlot;
  original_service_execution_at: string;
  proposed_slot: ServiceRescheduleSlot | null;
  proposed_at: string | null;
  adjustment_count: number;
  is_last_minute: boolean;
  chat_id: string;
}

export interface ServiceRescheduleSnapshot {
  contractedServiceId: string;
  activeRequest: ServiceRescheduleActiveRequest | null;
  displayStatus: string | null;
  canClientRequestReschedule: boolean;
  canProviderRequestReschedule: boolean;
  canProposeReschedule: boolean;
  canAcceptReschedule: boolean;
  canRequestAdjustment: boolean;
  canCancelReschedule: boolean;
}

export const SERVICE_RESCHEDULE_BUSINESS_ERROR_CODES = [
  "CONTRACTED_SERVICE_NOT_FOUND",
  "RESCHEDULE_REQUEST_NOT_FOUND",
  "FORBIDDEN",
  "INVALID_RESCHEDULE_STATUS",
  "RESCHEDULE_NOT_ALLOWED",
  "CLIENT_RESCHEDULE_WINDOW_CLOSED",
  "PROVIDER_RESCHEDULE_REQUIRES_CONFIRMED",
  "ACTIVE_RESCHEDULE_EXISTS",
  "ADJUSTMENT_LIMIT_REACHED",
  "CHAT_NOT_FOUND",
  "CHAT_NOT_ACTIVE",
  "PROPOSED_SLOT_REQUIRED",
  "INVALID_SLOT_SHAPE",
  "INVALID_SLOT_SHIFT",
  "INVALID_SLOT_START_DATE",
  "INVALID_SLOT_END_DATE",
  "OFFLINE",
] as const;

export type ServiceRescheduleBusinessErrorCode =
  (typeof SERVICE_RESCHEDULE_BUSINESS_ERROR_CODES)[number];

export interface ServiceRescheduleApiError {
  code: ServiceRescheduleBusinessErrorCode | "UNKNOWN";
  message: string;
  retryAfterSeconds?: number;
}

export interface ServiceRescheduleApiResult<T> {
  data: T | null;
  error: ServiceRescheduleApiError | null;
}

export interface ServiceRescheduleMutationResponse {
  reschedule_request_id?: string;
  chat_id?: string;
  deep_link_path?: string;
  reschedule: ServiceRescheduleSnapshot | null;
}
