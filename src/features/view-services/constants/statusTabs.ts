import type { ServiceListPhase } from "../types/service.types";

export type StatusTabId =
  | "all"
  | "negotiation"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "dispute";

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

export function statusToTabId(phase: ServiceListPhase): StatusTabId {
  return phase;
}

export function statusTabIdToListPhase(tabId: StatusTabId): ServiceListPhase | null {
  switch (tabId) {
    case "negotiation":
    case "in_progress":
    case "completed":
    case "cancelled":
    case "dispute":
      return tabId;
    default:
      return null;
  }
}

export function tabIncludesStatus(tabId: StatusTabId, phase: ServiceListPhase): boolean {
  if (tabId === "all") return true;
  return tabId === phase;
}
