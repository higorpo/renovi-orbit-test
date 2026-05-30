import { useCallback, useMemo } from "react";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  buildChatAnalyticsPayload,
  type ChatAnalyticsEventName,
  type ChatAnalyticsEventProperties,
} from "@/lib/analytics/events";

export type ChatAnalyticsTrackers = {
  [TEvent in ChatAnalyticsEventName]: (
    properties: ChatAnalyticsEventProperties[TEvent],
  ) => void;
};

/**
 * Typed chat analytics integration points for Phase 13 hooks.
 * Call only after the backing RPC succeeds — never on optimistic UI updates.
 */
export function useChatAnalytics(): ChatAnalyticsTrackers {
  const { trackEvent } = useAnalytics();

  const track = useCallback(
    <TEvent extends ChatAnalyticsEventName>(
      eventName: TEvent,
      properties: ChatAnalyticsEventProperties[TEvent],
    ) => {
      const payload = buildChatAnalyticsPayload(eventName, properties);
      trackEvent(payload.event, payload);
    },
    [trackEvent],
  );

  return useMemo(
    () => ({
      negotiation_message_sent: (properties) =>
        track("negotiation_message_sent", properties),
      proposal_submitted: (properties) => track("proposal_submitted", properties),
      proposal_accepted: (properties) => track("proposal_accepted", properties),
      proposal_rejected: (properties) => track("proposal_rejected", properties),
      revision_requested: (properties) => track("revision_requested", properties),
      conversation_closed: (properties) => track("conversation_closed", properties),
    }),
    [track],
  );
}
