import {
  CheckCircle2,
  Clock,
  FileText,
  GitCompare,
  History,
  MessageCircleQuestion,
  MessageSquareReply,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import type { QuestionPreviewItem, ReceivedStatusFilter, QuestionStatusFilter } from "../types/client-budgets.types";

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
  {
    id: "withdrawn",
    label: "Retirados",
    icon: Undo2,
    iconColor: "text-slate-500",
  },
];

export const QUESTION_FILTERS: Array<{
  id: QuestionStatusFilter;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}> = [
  {
    id: "pending",
    label: "Não respondidas",
    icon: MessageCircleQuestion,
    iconColor: "text-amber-500",
  },
  {
    id: "answered",
    label: "Respondidas",
    icon: MessageSquareReply,
    iconColor: "text-emerald-500",
  },
];

const BUDGET_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  pending: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  withdrawn: { label: "Retirado pelo prestador", variant: "secondary" },
  revised: { label: "Retirado pelo prestador", variant: "secondary" },
  expired: { label: "Expirado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  closed: { label: "Encerrado", variant: "secondary" },
  completed: { label: "Encerrado", variant: "secondary" },
};

function isBudgetFlowClosedServiceRequest(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return ["closed", "cancelled", "completed"].includes(normalized);
}

function isQuestionFlowClosedServiceRequest(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return ["in_progress", "closed", "cancelled", "completed"].includes(normalized);
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
    withdrawn_count: number;
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
    case "withdrawn":
      return Math.max(item.withdrawn_count - 2, 0);
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
  withdrawn_count: number;
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
  if (filter === "withdrawn") {
    const n = item.withdrawn_count;
    return `${n} retirado${n !== 1 ? "s" : ""} pelo prestador`;
  }
  return "";
}

export function getQuestionExtraCount(
  item: {
    total_questions: number;
    pending_questions_count: number;
    answered_questions_count: number;
    questions_preview: unknown[];
  },
  filter: QuestionStatusFilter,
): number {
  const shown = Math.min(2, item.questions_preview.length);
  switch (filter) {
    case "pending":
      return Math.max(item.pending_questions_count - shown, 0);
    case "answered":
      return Math.max(item.answered_questions_count - shown, 0);
    default:
      return 0;
  }
}

export function formatQuestionExtraLabel(extraCount: number): string {
  if (extraCount <= 0) return "";
  return "... e outras perguntas";
}

export function getQuestionCardSummaryLine(item: {
  total_questions: number;
  pending_questions_count: number;
  answered_questions_count: number;
}, filter: QuestionStatusFilter): string {
  if (filter === "pending") {
    const n = item.pending_questions_count;
    return `${n} perguntas pendente${n !== 1 ? "s" : ""}`;
  }
  if (filter === "answered") {
    const n = item.answered_questions_count;
    return `${n} perguntas respondida${n !== 1 ? "s" : ""}`;
  }
  return "";
}

export function getQuestionCardCtaLabel(): string {
  return "Ver perguntas";
}

export function getQuestionStatusConfig(question: Pick<QuestionPreviewItem, "client_response" | "client_responded_at"> & { service_request_status?: string | null }) {
  if (isQuestionFlowClosedServiceRequest(question.service_request_status)) {
    return { label: "Encerrada", variant: "secondary" as const };
  }
  if (question.client_response && question.client_responded_at) {
    return { label: "Respondida", variant: "success" as const };
  }
  return { label: "Não respondida", variant: "warning" as const };
}
