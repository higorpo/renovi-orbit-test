import type { BadgeProps } from "@/components/ui/badge";
import type { BudgetStatusFilter, QuestionStatusFilter } from "../types/provider-budgets.types";

export const BUDGET_STATUS_CONFIG: Record<
  string,
  { label: string; variant: BadgeProps["variant"] }
> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  withdrawn: { label: "Retirado", variant: "secondary" },
};

export function getBudgetStatusConfig(
  status: string | null | undefined,
): { label: string; variant: BadgeProps["variant"] } {
  const normalized = (status ?? "submitted").toLowerCase();
  return BUDGET_STATUS_CONFIG[normalized] ?? BUDGET_STATUS_CONFIG.submitted;
}

export const BUDGET_STATUS_FILTERS: { id: BudgetStatusFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "submitted", label: "Aguardando" },
  { id: "accepted", label: "Aceitos" },
  { id: "rejected", label: "Recusados" },
  { id: "withdrawn", label: "Retirados" },
];

/** Pedidos que não estão mais em `open`: fluxo de perguntas/pré-orçamento considerado encerrado no produto. */
const SERVICE_REQUEST_CLOSED_LIKE_STATUSES = new Set([
  "in_progress",
  "closed",
  "cancelled",
]);

function isServiceRequestClosedLike(status: string | null | undefined): boolean {
  if (!status) return false;
  return SERVICE_REQUEST_CLOSED_LIKE_STATUSES.has(status);
}

export function getQuestionStatusLabel(question: {
  client_response: string | null;
  service_request_status: string | null;
}): { label: string; variant: BadgeProps["variant"] } {
  const sr = question.service_request_status;

  if (sr === "cancelled") {
    return { label: "Pedido cancelado", variant: "secondary" };
  }
  if (sr === "closed") {
    return { label: "Pedido encerrado", variant: "secondary" };
  }
  if (sr === "in_progress") {
    return { label: "Pedido em andamento", variant: "secondary" };
  }
  if (question.client_response) {
    return { label: "Respondida", variant: "success" };
  }
  return { label: "Aguardando resposta", variant: "warning" };
}

export type QuestionStatusResolved = "pending" | "answered" | "closed";

export function resolveQuestionStatus(question: {
  client_response: string | null;
  service_request_status: string | null;
}): QuestionStatusResolved {
  if (isServiceRequestClosedLike(question.service_request_status)) {
    return "closed";
  }
  if (question.client_response) return "answered";
  return "pending";
}

export const QUESTION_STATUS_FILTERS: { id: QuestionStatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending", label: "Aguardando" },
  { id: "answered", label: "Respondidas" },
  { id: "closed", label: "Encerradas" },
];
