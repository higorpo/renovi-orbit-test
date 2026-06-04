import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getProposalResponseSlaHours } from "../api/platformConstants.api";
import type { ProposalStatus } from "../types/proposals.types";
import {
  computeProposalCountdown,
  resolveProposalExpiresAt,
  type ProposalCountdownSnapshot,
} from "../utils/proposalCountdown";
import { isPendingProposalStatus } from "../utils/proposalStatus";

const SLA_QUERY_KEY = "proposal-response-sla-hours";
const DEFAULT_TICK_MS = 30_000;

export interface UseProposalCountdownParams {
  status: ProposalStatus | null;
  submittedAt: string | null;
  enabled?: boolean;
  tickIntervalMs?: number;
}

export function useProposalCountdown({
  status,
  submittedAt,
  enabled = true,
  tickIntervalMs = DEFAULT_TICK_MS,
}: UseProposalCountdownParams): ProposalCountdownSnapshot & { slaHours: number | null } {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const slaQuery = useQuery({
    queryKey: [SLA_QUERY_KEY],
    queryFn: getProposalResponseSlaHours,
    enabled: enabled && Boolean(submittedAt),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const slaHours = slaQuery.data ?? null;

  const expiresAt = useMemo(() => {
    if (!enabled) return null;

    return resolveProposalExpiresAt({
      submittedAt,
      slaHours: slaHours ?? 24,
    });
  }, [enabled, slaHours, submittedAt]);

  useEffect(() => {
    if (!enabled || !isPendingProposalStatus(status) || !expiresAt) return;

    setNowMs(Date.now());
    const timerId = window.setInterval(() => setNowMs(Date.now()), tickIntervalMs);

    return () => window.clearInterval(timerId);
  }, [enabled, expiresAt, status, tickIntervalMs]);

  const snapshot = useMemo(
    () =>
      computeProposalCountdown({
        status,
        expiresAt,
        nowMs,
      }),
    [expiresAt, nowMs, status],
  );

  return {
    ...snapshot,
    slaHours,
  };
}
