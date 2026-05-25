/**
 * Lightweight Sentry spans for Edge Functions (design §10.3, task 81).
 * No-op when SENTRY_DSN is unset.
 */

import { createLogger } from "./logger.ts";

const log = createLogger("sentry-spans");

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  startSpan: <T>(
    context: { name: string; op?: string; attributes?: Record<string, string | number | boolean | undefined> },
    fn: (span: unknown) => T | Promise<T>,
  ) => T | Promise<T>;
  captureException: (error: unknown) => string | undefined;
};

let sentryModule: SentryLike | null = null;

let initialized = false;

function getDsn(): string | undefined {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  return dsn || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getDsn());
}

export async function initSentryEdge(serviceName: string): Promise<void> {
  const dsn = getDsn();
  if (!dsn || initialized) return;

  try {
    const Sentry = await import("@sentry/deno");
    Sentry.init({
      dsn,
      environment: Deno.env.get("ENVIRONMENT") ?? Deno.env.get("ENV") ?? "edge",
      tracesSampleRate: 1.0,
      defaultIntegrations: false,
    });
    sentryModule = Sentry as unknown as SentryLike;
    initialized = true;
    log.info("sentry.initialized", { service: serviceName });
  } catch (err) {
    log.warn("sentry.init_skipped", {
      service: serviceName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function withSpan<T>(
  name: string,
  op: string,
  attributes: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();

  if (!initialized || !sentryModule) {
    try {
      return await fn();
    } catch (error) {
      log.error("span.error", {
        span: name,
        op,
        duration_ms: Math.round(performance.now() - start),
        ...attributes,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return sentryModule.startSpan(
    { name, op, attributes },
    async () => {
      try {
        return await fn();
      } catch (error) {
        sentryModule?.captureException(error);
        throw error;
      } finally {
        log.debug("span.finished", {
          span: name,
          op,
          duration_ms: Math.round(performance.now() - start),
          ...attributes,
        });
      }
    },
  );
}
