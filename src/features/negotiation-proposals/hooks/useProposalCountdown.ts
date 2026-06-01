import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getProposalResponseSlaHours } from "../api/platformConstants.api";
import type { ProposalStatus } from "../types/proposals.types";
import {
  computeProposalCountdown,
  resolveProposalExpiresAt,
  type ProposalCountdownSnapshot,
} from "../utils/proposalCountdown";

const SLA_QUERY_KEY = "proposal-response-sla-hours";
const DEFAULT_TICK_MS = 30_000;

export interface UseProposalCountdownParams {
  status: ProposalStatus | null;
  submittedAt: string | null;
  /** Server-authoritative deadline — preferred over client-side SLA math (clock skew guard). */
  clientResponseDeadlineAt?: string | null;
  enabled?: boolean;
  tickIntervalMs?: number;
}

export function useProposalCountdown({
  status,
  submittedAt,
  clientResponseDeadlineAt = null,
  enabled = true,
  tickIntervalMs = DEFAULT_TICK_MS,
}: UseProposalCountdownParams): ProposalCountdownSnapshot & { slaHours: number | null } {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const needsSlaFallback = enabled && !clientResponseDeadlineAt && Boolean(submittedAt);

  const slaQuery = useQuery({
    queryKey: [SLA_QUERY_KEY],
    queryFn: getProposalResponseSlaHours,
    enabled: needsSlaFallback,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const slaHours = clientResponseDeadlineAt ? null : slaQuery.data ?? null;

  const expiresAt = useMemo(() => {
    if (!enabled) return null;

    return resolveProposalExpiresAt({
      submittedAt,
      clientResponseDeadlineAt,
      slaHours: slaHours ?? 24,
    });
  }, [clientResponseDeadlineAt, enabled, slaHours, submittedAt]);

  useEffect(() => {
    if (!enabled || status !== "PENDING" || !expiresAt) return;

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
