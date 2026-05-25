/**
 * Structured JSON logging for Edge Functions (Supabase log drain).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export interface LogEntry {
  level: LogLevel;
  scope: string;
  event: string;
  timestamp: string;
  correlation_id?: string;
  [key: string]: unknown;
}

export function buildLogEntry(
  level: LogLevel,
  scope: string,
  event: string,
  context: LogContext = {},
): LogEntry {
  const { correlation_id, ...rest } = context;
  const entry: LogEntry = {
    level,
    scope,
    event,
    timestamp: new Date().toISOString(),
    ...rest,
  };
  if (typeof correlation_id === "string" && correlation_id.length > 0) {
    entry.correlation_id = correlation_id;
  }
  return entry;
}

export function serializeLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeLog(entry: LogEntry): void {
  const line = serializeLogEntry(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

export interface EdgeLogger {
  debug(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
}

export function createLogger(scope: string): EdgeLogger {
  const logAt = (level: LogLevel, event: string, context: LogContext = {}): void => {
    writeLog(buildLogEntry(level, scope, event, context));
  };

  return {
    debug: (event, context) => logAt("debug", event, context),
    info: (event, context) => logAt("info", event, context),
    warn: (event, context) => logAt("warn", event, context),
    error: (event, context) => logAt("error", event, context),
  };
}
