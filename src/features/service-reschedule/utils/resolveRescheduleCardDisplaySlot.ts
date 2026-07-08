import type {
  ServiceRescheduleRequestStatus,
  ServiceRescheduleSlot,
} from "../types/serviceReschedule.types";

export function resolveRescheduleCardDisplaySlot(
  status: ServiceRescheduleRequestStatus | null,
  messageSlot: ServiceRescheduleSlot | null,
  originalSlot: ServiceRescheduleSlot | null,
  proposedSlot: ServiceRescheduleSlot | null,
): ServiceRescheduleSlot | null {
  if (status === "REQUESTED" || status === "ADJUSTMENT_REQUESTED") {
    return originalSlot;
  }

  if (status === "PROPOSED" || status === "ACCEPTED" || status === "SUPERSEDED") {
    return messageSlot ?? proposedSlot;
  }

  return proposedSlot ?? messageSlot;
}
