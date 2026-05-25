import { useQuery } from "@tanstack/react-query";
import { fetchAuditTimeline } from "../api/auditTimeline.api";

const AUDIT_STALE_MS = 30_000;

export function useAuditTimeline(dispatchId: string | null | undefined) {
  return useQuery({
    queryKey: ["message-dispatcher", "audit-timeline", dispatchId],
    queryFn: async () => {
      const { entries, error } = await fetchAuditTimeline(dispatchId!);
      if (error) {
        throw new Error(error);
      }
      return entries;
    },
    enabled: Boolean(dispatchId),
    staleTime: AUDIT_STALE_MS,
  });
}
