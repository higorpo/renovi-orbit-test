import type { QueryClient } from "@tanstack/react-query";
import { CHAT_ACTIVE_RESCHEDULE_QUERY_KEY } from "../hooks/useActiveChatReschedule";
import { CHAT_RESCHEDULE_TIMELINE_QUERY_KEY } from "../hooks/useRescheduleTimelineHydration";
import { SERVICE_RESCHEDULE_REQUEST_QUERY_KEY } from "../hooks/useRescheduleRequestDetail";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";

export function patchRescheduleQueryCaches(
  queryClient: QueryClient,
  chatId: string | null,
  snapshot: ServiceRescheduleSnapshot | null,
  options?: {
    supersededRequestId?: string | null;
    supersededSnapshot?: ServiceRescheduleSnapshot | null;
  },
): void {
  const requestId = snapshot?.activeRequest?.id;
  const resolvedChatId = chatId ?? snapshot?.activeRequest?.chat_id ?? null;

  if (resolvedChatId) {
    queryClient.setQueryData([CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, resolvedChatId], snapshot);
  }

  if (!requestId || !snapshot) return;

  if (resolvedChatId) {
    queryClient.setQueryData(
      [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, resolvedChatId, requestId],
      snapshot,
    );
  }

  queryClient.setQueryData([SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, requestId], snapshot);

  const supersededId = options?.supersededRequestId;
  const supersededSnapshot = options?.supersededSnapshot;
  if (supersededId && resolvedChatId) {
    if (supersededSnapshot) {
      queryClient.setQueryData(
        [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, resolvedChatId, supersededId],
        supersededSnapshot,
      );
      queryClient.setQueryData([SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, supersededId], supersededSnapshot);
    } else {
      void queryClient.invalidateQueries({
        queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, resolvedChatId, supersededId],
      });
      void queryClient.invalidateQueries({
        queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, supersededId],
      });
    }
  }
}
