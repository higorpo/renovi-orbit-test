import type { BadgeProps } from "@/components/ui/badge";
import type { QuestionPreviewItem, ReceivedStatusFilter, QuestionStatusFilter } from "../types/client-budgets.types";

export const RECEIVED_FILTERS: Array<{ id: ReceivedStatusFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "awaiting_decision", label: "Aguardando decisão" },
  { id: "accepted", label: "Aceitos" },
  { id: "rejected", label: "Recusados" },
  { id: "withdrawn", label: "Retirados" },
  { id: "closed", label: "Encerrados" },
];

export const QUESTION_FILTERS: Array<{ id: QuestionStatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
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

export function getQuestionStatusConfig(question: Pick<QuestionPreviewItem, "client_response" | "client_responded_at"> & { service_request_status?: string | null }) {
  if (question.service_request_status && ["in_progress", "closed", "cancelled"].includes(question.service_request_status)) {
    return { label: "Encerrada", variant: "secondary" as const };
  }
  if (question.client_response && question.client_responded_at) {
    return { label: "Respondida", variant: "success" as const };
  }
  return { label: "Não respondida", variant: "warning" as const };
}
