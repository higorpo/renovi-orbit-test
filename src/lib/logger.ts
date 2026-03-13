import { captureException, addBreadcrumb, isSentryEnabled, Sentry } from "@/lib/sentry";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const IS_DEV = import.meta.env.DEV;

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = import.meta.env.PROD ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

/** Serialize context for Sentry Logs attributes (Error objects as message/name). */
function toLogAttributes(context: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (v instanceof Error) {
      out[`${k}_message`] = v.message;
      out[`${k}_name`] = v.name;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function log(level: LogLevel, event: string, context: LogContext = {}): void {
  if (!shouldLog(level)) return;
  const payload = { event, ...context, timestamp: new Date().toISOString() };

  // Console: only in dev, so logs appear in the browser during development
  if (IS_DEV) {
    if (level === "error") console.error(`[${level}]`, event, context);
    else if (level === "warn") console.warn(`[${level}]`, event, context);
    else console.debug(`[${level}]`, event, payload);
  }

  // Sentry: in both dev and prod when VITE_SENTRY_DSN is set (breadcrumbs + Logs + Issues for error/warn)
  if (isSentryEnabled()) {
    if (level === "error") {
      const err = context.error instanceof Error ? context.error : new Error(event);
      captureException(err, { event, ...context });
    } else if (level === "warn") {
      const err = context.error instanceof Error ? context.error : new Error(event);
      captureException(err, { event, level: "warn", ...context });
    }

    addBreadcrumb({
      category: "logger",
      message: event,
      level: level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warning" : "error",
      data: context as Record<string, unknown>,
    });
    const attrs = { event, ...toLogAttributes(context) };
    try {
      if (level === "debug") Sentry.logger.debug(event, attrs);
      else if (level === "info") Sentry.logger.info(event, attrs);
      else if (level === "warn") Sentry.logger.warn(event, attrs);
      else Sentry.logger.error(event, attrs);
    } catch {
      // no-op if Sentry Logs not available
    }
  }
}

export const logger = {
  debug(event: string, context: LogContext = {}): void {
    log("debug", event, context);
  },
  info(event: string, context: LogContext = {}): void {
    log("info", event, context);
  },
  warn(event: string, context: LogContext = {}): void {
    log("warn", event, context);
  },
  error(event: string, context: LogContext = {}): void {
    log("error", event, context);
  },
};
