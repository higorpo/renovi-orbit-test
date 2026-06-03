import {
  CheckCircle2,
  Clock,
  FileText,
  GitCompare,
  History,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import type { ReceivedStatusFilter } from "../types/client-budgets.types";

const RECEIVED_CARD_CTA_ICONS = {
  details: FileText,
  compare: GitCompare,
  history: History,
} as const satisfies Record<string, LucideIcon>;

export const RECEIVED_FILTERS: Array<{
  id: ReceivedStatusFilter;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}> = [
  {
    id: "awaiting_decision",
    label: "Aguardando decisão",
    icon: Clock,
    iconColor: "text-amber-500",
  },
  {
    id: "accepted",
    label: "Aceitos",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  {
    id: "rejected",
    label: "Recusados",
    icon: XCircle,
    iconColor: "text-rose-500",
  },
];

const BUDGET_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  pending: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  rejected_automatically: { label: "Recusado", variant: "destructive" },
  revised: { label: "Orçamento revisado", variant: "secondary" },
  expired: { label: "Expirado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  closed: { label: "Encerrado", variant: "secondary" },
  completed: { label: "Encerrado", variant: "secondary" },
};

function isBudgetFlowClosedServiceRequest(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return ["closed", "cancelled", "completed"].includes(normalized);
}

export function getBudgetStatusConfig(status: string | null | undefined) {
  if (!status) return { label: "Aguardando avaliação", variant: "warning" as const };
  return BUDGET_STATUS_MAP[status.toLowerCase()] ?? { label: status, variant: "secondary" as const };
}

export function getServiceBudgetFlowStatus(summary: {
  service_request_status: string;
  submitted_count: number;
  accepted_count: number;
  total_budgets: number;
}): { label: string; variant: BadgeProps["variant"] } {
  if (summary.accepted_count > 0) return { label: "Orçamento aceito", variant: "success" };
  if (isBudgetFlowClosedServiceRequest(summary.service_request_status)) {
    return { label: "Encerrado", variant: "secondary" };
  }
  if (summary.submitted_count > 1) return { label: "Pronto para comparar", variant: "default" };
  if (summary.total_budgets > 0) return { label: "Aguardando decisão", variant: "warning" };
  return { label: "Sem orçamentos", variant: "secondary" };
}

export type ReceivedBudgetSheetMode = "compare" | "history";

export function getReceivedBudgetSheetMode(filter: ReceivedStatusFilter): ReceivedBudgetSheetMode {
  if (filter === "awaiting_decision") return "compare";
  return "history";
}

export function getReceivedBudgetSheetTitle(mode: ReceivedBudgetSheetMode): string {
  if (mode === "compare") return "Comparar orçamentos";
  return "Histórico de orçamentos";
}

export function getReceivedCardCtaLabel(
  filter: ReceivedStatusFilter,
  submittedCount?: number,
): string {
  if (filter === "awaiting_decision") {
    if (submittedCount === 1) return "Ver detalhes do orçamento";
    return "Comparar orçamentos";
  }
  return "Ver histórico de orçamentos";
}

export function getReceivedCardCtaIcon(
  filter: ReceivedStatusFilter,
  submittedCount?: number,
): LucideIcon {
  if (filter === "awaiting_decision") {
    if (submittedCount === 1) return RECEIVED_CARD_CTA_ICONS.details;
    return RECEIVED_CARD_CTA_ICONS.compare;
  }
  return RECEIVED_CARD_CTA_ICONS.history;
}

/** Extra rows beyond the two preview lines; derived from status counts (not preview length). */
export function getReceivedExtraBudgetCount(
  item: {
    total_budgets: number;
    submitted_count: number;
    accepted_count: number;
    rejected_count: number;
  },
  filter: ReceivedStatusFilter,
): number {
  switch (filter) {
    case "awaiting_decision":
      return Math.max(item.submitted_count - 2, 0);
    case "accepted":
      return Math.max(item.accepted_count - 2, 0);
    case "rejected":
      return Math.max(item.rejected_count - 2, 0);
    default:
      return 0;
  }
}

export function formatReceivedExtraBudgetsLabel(extraCount: number): string {
  if (extraCount <= 0) return "";
  return "... e outros orçamentos";
}

export function getReceivedBudgetSummaryLine(item: {
  total_budgets: number;
  submitted_count: number;
  accepted_count: number;
  rejected_count: number;
}, filter: ReceivedStatusFilter): string {
  if (filter === "awaiting_decision") {
    const n = item.submitted_count;
    return `${n} aguardando sua decisão`;
  }
  if (filter === "accepted") {
    const n = item.accepted_count;
    return `${n} orçamento${n !== 1 ? "s" : ""} aceito${n !== 1 ? "s" : ""}`;
  }
  if (filter === "rejected") {
    const n = item.rejected_count;
    return `${n} orçamento${n !== 1 ? "s" : ""} recusado${n !== 1 ? "s" : ""}`;
  }
  return "";
}
