import type { BadgeProps } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { BudgetStatusFilter } from "../types/provider-budgets.types";

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
