import type { ProposalStatus } from "../types/proposals.types";
import { isPendingProposalStatus } from "./proposalStatus";

export const PROPOSAL_COUNTDOWN_WARNING_MS = 4 * 60 * 60 * 1000;

export type ProposalCountdownPhase = "inactive" | "active" | "warning" | "expired";

export interface ProposalCountdownSnapshot {
  phase: ProposalCountdownPhase;
  expiresAt: Date | null;
  remainingMs: number;
  remainingLabel: string;
  isWarning: boolean;
  isExpired: boolean;
}

export function resolveProposalExpiresAt(params: {
  submittedAt: string | null;
  slaHours: number;
}): Date | null {
  if (!params.submittedAt) return null;

  const submitted = new Date(params.submittedAt);
  if (Number.isNaN(submitted.getTime())) return null;

  return new Date(submitted.getTime() + params.slaHours * 60 * 60 * 1000);
}

export function formatProposalRemainingMs(remainingMs: number): string {
  if (remainingMs <= 0) return "Prazo encerrado";

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} dia${days > 1 ? "s" : ""}${hours > 0 ? ` e ${hours} h` : ""}`;
  }

  if (hours > 0) {
    return `${hours} h${minutes > 0 ? ` ${minutes} min` : ""}`;
  }

  return `${minutes} min`;
}

export function computeProposalCountdown(params: {
  status: ProposalStatus | null;
  expiresAt: Date | null;
  nowMs?: number;
}): ProposalCountdownSnapshot {
  const nowMs = params.nowMs ?? Date.now();

  if (!isPendingProposalStatus(params.status)) {
    const isExpiredStatus = params.status === "EXPIRED";
    return {
      phase: isExpiredStatus ? "expired" : "inactive",
      expiresAt: params.expiresAt,
      remainingMs: 0,
      remainingLabel: isExpiredStatus ? "Proposta expirada" : "",
      isWarning: false,
      isExpired: isExpiredStatus,
    };
  }

  if (!params.expiresAt) {
    return {
      phase: "inactive",
      expiresAt: null,
      remainingMs: 0,
      remainingLabel: "",
      isWarning: false,
      isExpired: false,
    };
  }

  const remainingMs = params.expiresAt.getTime() - nowMs;

  if (remainingMs <= 0) {
    return {
      phase: "expired",
      expiresAt: params.expiresAt,
      remainingMs: 0,
      remainingLabel: "Prazo encerrado",
      isWarning: false,
      isExpired: true,
    };
  }

  const isWarning = remainingMs <= PROPOSAL_COUNTDOWN_WARNING_MS;

  return {
    phase: isWarning ? "warning" : "active",
    expiresAt: params.expiresAt,
    remainingMs,
    remainingLabel: formatProposalRemainingMs(remainingMs),
    isWarning,
    isExpired: false,
  };
}
