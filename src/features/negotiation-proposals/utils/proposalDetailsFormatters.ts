import {
  coerceProposalStatus,
  defineProposalStatusMap,
} from "../constants/proposalStatus";
import type { ProposalStatus } from "../types/proposals.types";

const PROPOSAL_STATUS_LABELS = defineProposalStatusMap({
  PENDING: "Aguardando resposta",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  REJECTED_AUTOMATICALLY: "Recusada automaticamente",
  EXPIRED: "Expirada",
  REVISION_REQUESTED: "Revisão solicitada",
  REVISED: "Atualizada",
});

export function getProposalStatusLabel(status: ProposalStatus | string | null): string {
  if (!status) return "Desconhecido";

  const resolved = coerceProposalStatus(status);
  if (resolved) return PROPOSAL_STATUS_LABELS[resolved];

  return status;
}

export function formatProposalDateTime(value: string | null | undefined): string {
  if (!value) return "Data indisponível";
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsedDate);
}

export function formatProposalDateOnly(value: string | null | undefined): string {
  if (!value) return "Data indisponível";
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsedDate);
}

export function translateProposalShift(
  shift: "morning" | "afternoon" | "full_day" | string,
): string {
  if (shift === "morning") return "Manhã";
  if (shift === "afternoon") return "Tarde";
  if (shift === "full_day") return "Dia inteiro";
  return shift;
}
