import {
  buildChatAnalyticsPayload,
  type ChatAnalyticsEventName,
  type ChatAnalyticsEventProperties,
  type ChatAnalyticsPayload,
} from "./events";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function pushChatAnalyticsEvent<TEvent extends ChatAnalyticsEventName>(
  eventName: TEvent,
  properties: ChatAnalyticsEventProperties[TEvent],
): ChatAnalyticsPayload<TEvent> {
  const payload = buildChatAnalyticsPayload(eventName, properties);

  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  }

  if (import.meta.env.DEV) {
    console.debug("[Analytics]", payload.event, payload);
  }

  return payload;
}
