/**
 * Status tab configuration for "Meus Serviços" page.
 * Maps DB status (open, in_progress, closed, cancelled) to UI tabs.
 * Negotiation, professional_selected, and dispute are reserved for future DB support.
 */

export const SERVICE_REQUEST_DB_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  CLOSED: "closed",
  CANCELLED: "cancelled",
} as const;

export type ServiceRequestDbStatus =
  (typeof SERVICE_REQUEST_DB_STATUS)[keyof typeof SERVICE_REQUEST_DB_STATUS];

/** Tab id used in URL/state. "all" and status-based. */
export type StatusTabId =
  | "all"
  | "waiting_proposals"
  | "negotiation"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "dispute";

export interface StatusTabConfig {
  id: StatusTabId;
  label: string;
  /** DB statuses that belong to this tab (empty for all, negotiation, dispute if not in DB yet). */
  statuses: ServiceRequestDbStatus[];
}

export const STATUS_TABS: StatusTabConfig[] = [
  { id: "all", label: "Todos", statuses: [] },
  {
    id: "waiting_proposals",
    label: "Aguardando orçamentos",
    statuses: [SERVICE_REQUEST_DB_STATUS.OPEN],
  },
  { id: "negotiation", label: "Em negociação", statuses: [] },
  {
    id: "in_progress",
    label: "Em andamento",
    statuses: [SERVICE_REQUEST_DB_STATUS.IN_PROGRESS],
  },
  {
    id: "completed",
    label: "Concluídos",
    statuses: [SERVICE_REQUEST_DB_STATUS.CLOSED],
  },
  {
    id: "cancelled",
    label: "Cancelados",
    statuses: [SERVICE_REQUEST_DB_STATUS.CANCELLED],
  },
  { id: "dispute", label: "Disputas", statuses: [] },
];

export const DEFAULT_STATUS_TAB_ID: StatusTabId = "all";

/** Map DB status to the tab id that contains it. */
export function statusToTabId(status: ServiceRequestDbStatus): StatusTabId {
  switch (status) {
    case SERVICE_REQUEST_DB_STATUS.OPEN:
      return "waiting_proposals";
    case SERVICE_REQUEST_DB_STATUS.IN_PROGRESS:
      return "in_progress";
    case SERVICE_REQUEST_DB_STATUS.CLOSED:
      return "completed";
    case SERVICE_REQUEST_DB_STATUS.CANCELLED:
      return "cancelled";
    default:
      return "all";
  }
}

/** Check if a DB status is included in the given tab. */
export function tabIncludesStatus(
  tabId: StatusTabId,
  status: ServiceRequestDbStatus
): boolean {
  if (tabId === "all") return true;
  const tab = STATUS_TABS.find((t) => t.id === tabId);
  if (!tab || tab.statuses.length === 0) return false;
  return tab.statuses.includes(status);
}
