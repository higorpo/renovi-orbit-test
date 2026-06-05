import {
  isContractedServiceCancelled,
  isContractedServiceCompleted,
} from "../constants/contractedServiceStatus";
import type { StatusTabId } from "../constants/statusTabs";

export type ServiceRequestListPhase =
  | "negotiation"
  | "in_progress"
  | "completed"
  | "cancelled";

export function normalizeServiceRequestStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

export function deriveServiceRequestListPhase(input: {
  status: string | null | undefined;
  contractedServiceStatus?: string | null | undefined;
}): ServiceRequestListPhase {
  const normalized = normalizeServiceRequestStatus(input.status);

  if (normalized === "CANCELLED") return "cancelled";

  if (normalized === "COMPLETED") {
    if (isContractedServiceCancelled(input.contractedServiceStatus)) return "cancelled";
    if (isContractedServiceCompleted(input.contractedServiceStatus)) return "completed";
    return "in_progress";
  }

  return "negotiation";
}

export function listPhaseToStatusTabId(phase: ServiceRequestListPhase): StatusTabId {
  return phase;
}

export function statusTabIdToListPhase(tabId: StatusTabId): ServiceRequestListPhase | null {
  switch (tabId) {
    case "negotiation":
    case "in_progress":
    case "completed":
    case "cancelled":
      return tabId;
    default:
      return null;
  }
}
