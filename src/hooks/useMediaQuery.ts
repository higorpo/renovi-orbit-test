import { useSyncExternalStore } from "react";

type MediaQuerySubscription = {
  subscribe: (callback: () => void) => () => void;
  getSnapshot: () => boolean;
};

const subscriptions = new Map<string, MediaQuerySubscription>();

function getMediaQuerySubscription(query: string): MediaQuerySubscription {
  const cached = subscriptions.get(query);
  if (cached) return cached;

  const mediaQueryList = window.matchMedia(query);
  const listeners = new Set<() => void>();

  mediaQueryList.addEventListener("change", () => {
    listeners.forEach((listener) => listener());
  });

  const subscription: MediaQuerySubscription = {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot: () => mediaQueryList.matches,
  };

  subscriptions.set(query, subscription);
  return subscription;
}

function getServerSnapshot() {
  return true;
}

export function useMediaQuery(query: string): boolean {
  const { subscribe, getSnapshot } = getMediaQuerySubscription(query);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
