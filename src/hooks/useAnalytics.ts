/**
 * Analytics - dispara eventos para GTM/dataLayer quando disponível.
 */
interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function useAnalytics() {
  const trackEvent = (eventName: string, properties?: EventProperties) => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...properties,
      timestamp: new Date().toISOString(),
    });
    if (import.meta.env.DEV) {
      console.debug("[Analytics]", eventName, properties);
    }
  };
  return { trackEvent };
}
