import type { ServiceRequestDbStatus } from "./statusTabs";

export const STATUS_LABELS: Record<ServiceRequestDbStatus, string> = {
  open: "Aguardando orçamentos",
  in_progress: "Em andamento",
  closed: "Concluído",
  cancelled: "Cancelado",
};

export function getStatusLabel(
  status: ServiceRequestDbStatus,
  hasSubmittedProposal?: boolean
): string {
  if (status === "open" && hasSubmittedProposal) {
    return "Aguardando decisão";
  }

  return STATUS_LABELS[status];
}

/** Badge variant for shadcn Badge component. */
export type StatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export const STATUS_BADGE_VARIANT: Record<
  ServiceRequestDbStatus,
  StatusBadgeVariant
> = {
  open: "warning",
  in_progress: "default",
  closed: "success",
  cancelled: "secondary",
};

export function getStatusBadgeVariant(
  status: ServiceRequestDbStatus,
  proposalCount?: number
): StatusBadgeVariant {
  if (status === "open" && (proposalCount ?? 0) === 0) {
    return "secondary";
  }

  return STATUS_BADGE_VARIANT[status];
}
