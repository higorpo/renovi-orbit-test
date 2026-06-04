import type { ServiceRequestListPhase } from "../utils/serviceRequestListPhase";

/** Tab id used in URL/state. */
export type StatusTabId =
  | "all"
  | "negotiation"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "dispute";

/** Legacy alias kept for mapper/tests that reference DB-shaped status strings. */
export type ServiceRequestDbStatus = "open" | "in_progress" | "closed" | "cancelled";

export interface StatusTabConfig {
  id: StatusTabId;
  label: string;
}

export const STATUS_TABS: StatusTabConfig[] = [
  { id: "all", label: "Todos" },
  { id: "negotiation", label: "Em negociação" },
  { id: "in_progress", label: "Em andamento" },
  { id: "completed", label: "Concluídos" },
  { id: "cancelled", label: "Cancelados" },
  { id: "dispute", label: "Disputas" },
];

export const DEFAULT_STATUS_TAB_ID: StatusTabId = "all";

export function statusToTabId(phase: ServiceRequestListPhase): StatusTabId {
  return phase;
}

export function tabIncludesStatus(
  tabId: StatusTabId,
  phase: ServiceRequestListPhase,
): boolean {
  if (tabId === "all") return true;
  if (tabId === "dispute") return false;
  return tabId === phase;
}
