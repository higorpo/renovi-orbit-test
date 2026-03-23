import type { BadgeProps } from "@/components/ui/badge";
import type { QuestionPreviewItem, ReceivedStatusFilter, QuestionStatusFilter } from "../types/client-budgets.types";

export const RECEIVED_FILTERS: Array<{ id: ReceivedStatusFilter; label: string }> = [
  { id: "awaiting_decision", label: "Aguardando decisão" },
  { id: "accepted", label: "Aceitos" },
  { id: "rejected", label: "Recusados" },
  { id: "withdrawn", label: "Retirados" },
  { id: "closed", label: "Encerrados" },
];

export const QUESTION_FILTERS: Array<{ id: QuestionStatusFilter; label: string }> = [
  { id: "pending", label: "Não respondidas" },
  { id: "answered", label: "Respondidas" },
  { id: "closed", label: "Encerradas" },
];

const BUDGET_STATUS_MAP: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  withdrawn: { label: "Retirado pelo prestador", variant: "secondary" },
  expired: { label: "Expirado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "secondary" },
  closed: { label: "Encerrado", variant: "secondary" },
};

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
  if (summary.service_request_status === "closed" || summary.service_request_status === "cancelled") {
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

export function getReceivedCardCtaLabel(filter: ReceivedStatusFilter): string {
  if (filter === "awaiting_decision") return "Comparar orçamentos";
  return "Ver histórico de orçamentos";
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
    case "closed":
      if (item.accepted_count > 0) return Math.max(item.accepted_count - 2, 0);
      return Math.max(item.total_budgets - 2, 0);
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
  const n = item.total_budgets;
  return `${n} orçamento${n !== 1 ? "s" : ""} no histórico`;
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
    case "closed":
      return Math.max(item.total_questions - shown, 0);
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
    const t = item.total_questions;
    return `${n} pendente${n !== 1 ? "s" : ""} de ${t} pergunta${t !== 1 ? "s" : ""} (até 3 por prestador)`;
  }
  if (filter === "answered") {
    const n = item.answered_questions_count;
    const t = item.total_questions;
    return `${n} respondida${n !== 1 ? "s" : ""} de ${t} pergunta${t !== 1 ? "s" : ""}`;
  }
  const t = item.total_questions;
  return `${t} pergunta${t !== 1 ? "s" : ""} (pedido encerrado)`;
}

export function getQuestionCardCtaLabel(filter: QuestionStatusFilter): string {
  if (filter === "closed") return "Ver histórico de perguntas";
  return "Ver perguntas";
}

export function getQuestionStatusConfig(question: Pick<QuestionPreviewItem, "client_response" | "client_responded_at"> & { service_request_status?: string | null }) {
  if (question.service_request_status && ["in_progress", "closed", "cancelled"].includes(question.service_request_status)) {
    return { label: "Encerrada", variant: "secondary" as const };
  }
  if (question.client_response && question.client_responded_at) {
    return { label: "Respondida", variant: "success" as const };
  }
  return { label: "Não respondida", variant: "warning" as const };
}
