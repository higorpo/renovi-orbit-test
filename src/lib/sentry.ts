/**
 * Sentry initialization and helpers. Initializes only when VITE_SENTRY_DSN is set.
 * Exposes captureException, addBreadcrumb, and metrics for instrumentation.
 */

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE;
const IS_PROD = import.meta.env.PROD;

let initialized = false;

export function isSentryEnabled(): boolean {
  return Boolean(DSN && DSN.length > 0);
}

export function initSentry(): void {
  if (!isSentryEnabled() || initialized) return;
  const release = typeof __APP_VERSION__ !== "undefined" ? `orbit@${__APP_VERSION__}` : undefined;
  Sentry.init({
    dsn: DSN,
    release,
    environment: ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: IS_PROD ? 0.2 : 1,
    // Only propagate trace to our own backend. Exclude third-party APIs (e.g. ViaCEP)
    // so CORS preflight is not triggered by sentry-trace/baggage headers.
    tracePropagationTargets: [/^\//, /^https:\/\/[^/]*\.supabase\.co\//],
    // Session replay: 10% of sessions in prod, 50% in dev; 100% of sessions where an error is sent
    replaysSessionSampleRate: IS_PROD ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1,
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error && typeof error === "object" && "message" in error) {
        const msg = String((error as { message?: string }).message);
        if (msg.includes("ResizeObserver") || msg.includes("Non-Error promise rejection")) {
          return null;
        }
      }
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error promise rejection",
      "Loading chunk",
      "ChunkLoadError",
    ],
    enableLogs: true
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): string | undefined {
  if (!isSentryEnabled()) return undefined;
  return Sentry.captureException(error, { extra: context });
}

/**
 * Send user feedback for an event (e.g. from Error Boundary). Associates feedback with the error in Sentry.
 */
export function captureUserFeedback(params: {
  event_id: string;
  name?: string;
  email?: string;
  comments: string;
}): void {
  if (!isSentryEnabled()) return;
  Sentry.captureFeedback({
    message: params.comments,
    name: params.name,
    email: params.email,
    associatedEventId: params.event_id,
  });
}

/**
 * Set the current user for Sentry. All subsequent events (errors, breadcrumbs, metrics)
 * will be associated with this user. Call with null on logout to clear.
 */
export function setSentryUser(user: { id: string; email?: string | null } | null): void {
  if (!isSentryEnabled()) return;
  if (user === null) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    ...(user.email != null && user.email !== "" && { email: user.email }),
  });
}

export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: "debug" | "info" | "warning" | "error";
  data?: Record<string, unknown>;
}): void {
  if (!isSentryEnabled()) return;
  Sentry.addBreadcrumb({
    category: breadcrumb.category ?? "app",
    message: breadcrumb.message,
    level: breadcrumb.level ?? "info",
    data: breadcrumb.data,
  });
}

export const metrics = {
  count(name: string, value: number = 1, attributes?: Record<string, string>): void {
    if (!isSentryEnabled()) return;
    try {
      Sentry.metrics.count(name, value, attributes ? { attributes } : undefined);
    } catch {
      // no-op if metrics not supported
    }
  },
  distribution(name: string, value: number, attributes?: Record<string, string>): void {
    if (!isSentryEnabled()) return;
    try {
      Sentry.metrics.distribution(name, value, attributes ? { attributes } : undefined);
    } catch {
      // no-op
    }
  },
};

export { Sentry };
