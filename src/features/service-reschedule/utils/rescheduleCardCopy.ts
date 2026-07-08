import type { ProfileRole } from "@/features/auth";
import type { ServiceRescheduleRequestStatus } from "../types/serviceReschedule.types";

export type RescheduleCardCtaId =
  | "accept"
  | "request_adjustment"
  | "cancel"
  | "propose";

export interface RescheduleCardCta {
  id: RescheduleCardCtaId;
  label: string;
  variant: "default" | "outline" | "destructive";
}

export function resolveRescheduleCardHeadline(
  status: ServiceRescheduleRequestStatus,
  viewerRole: ProfileRole,
): string {
  if (status === "PROPOSED") {
    return viewerRole === "client" ? "Nova data proposta" : "Aguardando confirmação do cliente";
  }

  if (status === "ADJUSTMENT_REQUESTED") {
    return viewerRole === "client"
      ? "Ajuste solicitado"
      : "Cliente pediu outra data";
  }

  return viewerRole === "provider"
    ? "Reagendamento solicitado"
    : "Aguardando proposta do prestador";
}

export function resolveRescheduleCardDescription(
  status: ServiceRescheduleRequestStatus,
  viewerRole: ProfileRole,
): string {
  if (status === "PROPOSED") {
    return viewerRole === "client"
      ? "Revise a nova data proposta e confirme ou peça um ajuste pelo chat."
      : "O cliente pode aceitar ou pedir ajustes na data proposta.";
  }

  if (status === "ADJUSTMENT_REQUESTED") {
    return viewerRole === "provider"
      ? "Envie uma nova proposta de data para o cliente."
      : "O prestador foi notificado para enviar outra data.";
  }

  return viewerRole === "provider"
    ? "Proponha uma nova data para este serviço."
    : "O prestador vai propor uma nova data em breve.";
}

export function resolveRescheduleCardCtas(
  status: ServiceRescheduleRequestStatus,
  viewerRole: ProfileRole,
  flags: {
    canPropose: boolean;
    canAccept: boolean;
    canRequestAdjustment: boolean;
    canCancel: boolean;
  },
): RescheduleCardCta[] {
  const ctas: RescheduleCardCta[] = [];

  if (viewerRole === "provider" && flags.canPropose) {
    ctas.push({ id: "propose", label: "Propor nova data", variant: "default" });
  }

  if (viewerRole === "client" && status === "PROPOSED") {
    if (flags.canAccept) {
      ctas.push({ id: "accept", label: "Confirmar nova data", variant: "default" });
    }
    if (flags.canRequestAdjustment) {
      ctas.push({ id: "request_adjustment", label: "Pedir ajuste", variant: "outline" });
    }
  }

  if (flags.canCancel) {
    ctas.push({ id: "cancel", label: "Cancelar solicitação", variant: "destructive" });
  }

  return ctas;
}
