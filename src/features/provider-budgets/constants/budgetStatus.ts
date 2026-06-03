import type { BadgeProps } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  MessageCircleQuestion,
  MessageSquareReply,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BudgetStatusFilter, QuestionStatusFilter } from "../types/provider-budgets.types";

export const BUDGET_STATUS_CONFIG: Record<
  string,
  { label: string; variant: BadgeProps["variant"] }
> = {
  submitted: { label: "Aguardando avaliação", variant: "warning" },
  pending: { label: "Aguardando avaliação", variant: "warning" },
  accepted: { label: "Aceito", variant: "success" },
  rejected: { label: "Recusado", variant: "destructive" },
  rejected_automatically: { label: "Recusado", variant: "destructive" },
  revised: { label: "Orçamento revisado", variant: "secondary" },
};

export function getBudgetStatusConfig(
  status: string | null | undefined,
): { label: string; variant: BadgeProps["variant"] } {
  if (status == null || status === "") {
    return { label: "Desconhecido", variant: "secondary" };
  }
  const normalized = status.toLowerCase();
  return (
    BUDGET_STATUS_CONFIG[normalized] ?? {
      label: "Desconhecido",
      variant: "secondary" as const,
    }
  );
}

export const BUDGET_STATUS_FILTERS: Array<{
  id: BudgetStatusFilter;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}> = [
  {
    id: "submitted",
    label: "Aguardando",
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

/** Service requests no longer accepting question flow (CNS + legacy statuses). */
const SERVICE_REQUEST_CLOSED_LIKE_STATUSES = new Set([
  "in_progress",
  "closed",
  "cancelled",
  "completed",
]);

function isServiceRequestClosedLike(status: string | null | undefined): boolean {
  if (!status) return false;
  return SERVICE_REQUEST_CLOSED_LIKE_STATUSES.has(status.toLowerCase());
}

export function getQuestionStatusLabel(question: {
  client_response: string | null;
  service_request_status: string | null;
}): { label: string; variant: BadgeProps["variant"] } {
  const sr = question.service_request_status?.toLowerCase() ?? "";

  if (sr === "cancelled") {
    return { label: "Pedido cancelado", variant: "secondary" };
  }
  if (sr === "closed" || sr === "completed") {
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

export const QUESTION_STATUS_FILTERS: Array<{
  id: QuestionStatusFilter;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}> = [
  {
    id: "pending",
    label: "Aguardando",
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
