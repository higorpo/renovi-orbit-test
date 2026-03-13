import { captureException, addBreadcrumb, isSentryEnabled } from "@/lib/sentry";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

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

function log(level: LogLevel, event: string, context: LogContext = {}): void {
  if (!shouldLog(level)) return;
  const payload = { event, ...context, timestamp: new Date().toISOString() };
  if (level === "error") {
    console.error(`[${level}]`, event, context);
    if (isSentryEnabled()) {
      const err = context.error instanceof Error ? context.error : new Error(event);
      captureException(err, { event, ...context });
    }
  } else if (level === "warn") {
    console.warn(`[${level}]`, event, context);
    if (isSentryEnabled()) {
      const err = context.error instanceof Error ? context.error : new Error(event);
      captureException(err, { event, level: "warn", ...context });
    }
  } else if (import.meta.env.DEV) {
    console.debug(`[${level}]`, event, payload);
  }
  if (isSentryEnabled()) {
    addBreadcrumb({
      category: "logger",
      message: event,
      level: level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warning" : "error",
      data: context as Record<string, unknown>,
    });
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
