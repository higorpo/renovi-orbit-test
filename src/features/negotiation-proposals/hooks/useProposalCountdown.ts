import { useEffect, useMemo, useState } from "react";
import type { ProposalStatus } from "../types/proposals.types";
import {
  computeProposalCountdown,
  type ProposalCountdownSnapshot,
} from "../utils/proposalCountdown";
import { isPendingProposalStatus } from "../utils/proposalStatus";

const DEFAULT_TICK_MS = 30_000;

export interface UseProposalCountdownParams {
  status: ProposalStatus | null;
  /** Server-computed client-response deadline (ISO). */
  expiresAt: string | null;
  enabled?: boolean;
  tickIntervalMs?: number;
}

function parseExpiresAt(expiresAt: string | null): Date | null {
  if (!expiresAt) return null;
  const parsed = new Date(expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function useProposalCountdown({
  status,
  expiresAt,
  enabled = true,
  tickIntervalMs = DEFAULT_TICK_MS,
}: UseProposalCountdownParams): ProposalCountdownSnapshot {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const expiresAtDate = useMemo(() => {
    if (!enabled) return null;
    return parseExpiresAt(expiresAt);
  }, [enabled, expiresAt]);

  useEffect(() => {
    if (!enabled || !isPendingProposalStatus(status) || !expiresAtDate) return;

    setNowMs(Date.now());
    const timerId = window.setInterval(() => setNowMs(Date.now()), tickIntervalMs);

    return () => window.clearInterval(timerId);
  }, [enabled, expiresAtDate, status, tickIntervalMs]);

  return useMemo(
    () =>
      computeProposalCountdown({
        status,
        expiresAt: expiresAtDate,
        nowMs,
      }),
    [expiresAtDate, nowMs, status],
  );
}
