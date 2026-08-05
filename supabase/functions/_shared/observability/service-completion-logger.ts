/**
 * Service-completion structured logs + redaction (design §10.1 / §10.5, Task 55).
 * Prefer ids + error codes; never log checklist free text or evidence URLs.
 */

import {
  createLogger,
  type EdgeLogger,
  type LogContext,
} from "../logger.ts";

export const SERVICE_COMPLETION_LOG_EVENTS = {
  ENRICHMENT_CONTEXT_MISSING: "enrichment_context_missing",
  ENRICHMENT_CONTEXT_TRUNCATED: "enrichment_context_truncated",
  ENRICHMENT_FINALIZE_AI: "enrichment_finalize_ai_attempt",
  ENRICHMENT_FALLBACK: "enrichment_fallback_template",
  ENRICHMENT_ROW_ERROR: "enrichment_row_error",
  ENRICHMENT_ROW_EXCEPTION: "enrichment_row_exception",
  ENRICHMENT_WORKER_FATAL: "generate_completion_checklist_fatal",
  FALLBACK_TEMPLATE_INVALID: "fallback_template_invalid_schema",
  LOAD_CONTEXT_FAILED: "enrichment_load_context_failed",
  UPLOAD_URL_FATAL: "issue_completion_evidence_upload_url_fatal",
} as const;

/** Distinguishes failure / success classes for Sentry tags and log filters. */
export type ServiceCompletionOutcome =
  | "transient_llm"
  | "validation"
  | "fallback"
  | "ops_attention"
  | "ready_ai"
  | "retry_scheduled"
  | "noop"
  | "mark_executed"
  | "confirm"
  | "auto_complete"
  | "upload_url"
  | "error";

export type ServiceCompletionLogFields = {
  service_request_id?: string | null;
  enrichment_id?: string | null;
  contracted_service_id?: string | null;
  attempt?: number | null;
  attempt_count?: number | null;
  lease_generation?: number | null;
  correlation_id?: string | null;
  outcome?: ServiceCompletionOutcome | string | null;
  error_code?: string | null;
};

const BLOCKED_KEYS = new Set([
  "label",
  "labels",
  "justification",
  "justifications",
  "free_text",
  "freetext",
  "checklist_schema",
  "schema",
  "blocks",
  "responses",
  "draft_responses",
  "evidence_url",
  "evidence_urls",
  "signed_url",
  "signedurl",
  "upload_url",
  "uploadurl",
  "url",
  "urls",
  "path",
  "storage_path",
  "storagepath",
  "token",
  "authorization",
  "password",
  "raw_body",
  "rawbody",
  "description",
  "title",
  "comment",
  "comments",
]);

const URLISH =
  /https?:\/\/|supabase\.co\/storage|\.supabase\.co\/storage|signedUrl|token=/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scrubString(value: string): string | "[redacted_url]" {
  if (URLISH.test(value)) return "[redacted_url]";
  return value;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key.toLowerCase())) {
      continue;
    }
    sanitized[key] = sanitizeValue(nested);
  }
  return sanitized;
}

export function sanitizeServiceCompletionLogContext(
  context: LogContext = {},
): LogContext {
  return sanitizeValue(context) as LogContext;
}

export function buildServiceCompletionLogContext(
  fields: ServiceCompletionLogFields & LogContext = {},
): LogContext {
  const {
    service_request_id,
    enrichment_id,
    contracted_service_id,
    attempt,
    attempt_count,
    lease_generation,
    correlation_id,
    outcome,
    error_code,
    ...rest
  } = fields;

  const context: LogContext = {
    ...(sanitizeServiceCompletionLogContext(rest) as LogContext),
  };

  if (service_request_id) context.service_request_id = service_request_id;
  if (enrichment_id) context.enrichment_id = enrichment_id;
  if (contracted_service_id) {
    context.contracted_service_id = contracted_service_id;
  }

  const attemptValue = attempt ?? attempt_count;
  if (typeof attemptValue === "number") {
    context.attempt = attemptValue;
    context.attempt_count = attemptValue;
  }

  if (typeof lease_generation === "number") {
    context.lease_generation = lease_generation;
  }

  if (outcome) context.outcome = outcome;
  if (error_code) context.error_code = error_code;

  if (typeof correlation_id === "string" && correlation_id.length > 0) {
    context.correlation_id = correlation_id;
  }

  return context;
}

/** Attributes safe for Sentry span / exception tags. */
export function serviceCompletionSentryTags(
  fields: ServiceCompletionLogFields,
): Record<string, string | number | boolean | undefined> {
  const ctx = buildServiceCompletionLogContext(fields);
  const tags: Record<string, string | number | boolean | undefined> = {
    feature: "service_completion",
  };
  for (const key of [
    "service_request_id",
    "enrichment_id",
    "contracted_service_id",
    "attempt",
    "lease_generation",
    "outcome",
    "correlation_id",
    "error_code",
  ] as const) {
    const value = ctx[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      tags[key] = value;
    }
  }
  return tags;
}

export function outcomeFromProcessKind(
  kind: string,
): ServiceCompletionOutcome {
  switch (kind) {
    case "ready_ai":
      return "ready_ai";
    case "ready_fallback":
      return "fallback";
    case "retry_scheduled":
      return "transient_llm";
    case "ops_attention":
      return "ops_attention";
    case "noop":
      return "noop";
    default:
      return "error";
  }
}

function wrapLogger(base: EdgeLogger): EdgeLogger {
  return {
    debug: (event, context) =>
      base.debug(event, buildServiceCompletionLogContext(context)),
    info: (event, context) =>
      base.info(event, buildServiceCompletionLogContext(context)),
    warn: (event, context) =>
      base.warn(event, buildServiceCompletionLogContext(context)),
    error: (event, context) =>
      base.error(event, buildServiceCompletionLogContext(context)),
  };
}

export function createServiceCompletionLogger(scope: string): EdgeLogger {
  return wrapLogger(createLogger(scope));
}
