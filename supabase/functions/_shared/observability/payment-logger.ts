import {
  createLogger,
  type EdgeLogger,
  type LogContext,
} from "../logger.ts";

export const PAYMENT_LOG_EVENTS = {
  CHARGE_ATTEMPT_STARTED: "charge_attempt_started",
  CHARGE_ATTEMPT_COMPLETED: "charge_attempt_completed",
  CHARGE_ATTEMPT_FAILED: "charge_attempt_failed",
  WEBHOOK_RECEIVED: "webhook_received",
  WEBHOOK_PROCESSED: "webhook_processed",
  ORPHAN_RECOVERED: "orphan_recovered",
} as const;

export type PaymentLogFields = {
  service_id?: string;
  schedule_id?: string;
  gateway_slug?: string;
  error_code?: string;
};

const BLOCKED_PAYMENT_LOG_KEYS = new Set([
  "cardNumber",
  "cvv",
  "password",
  "token",
  "authorization",
  "rawBody",
  "pan",
  "card_number",
  "billingAddress",
]);

export function sanitizePaymentLogContext(
  context: LogContext = {},
): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (BLOCKED_PAYMENT_LOG_KEYS.has(key)) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

export function buildPaymentLogContext(
  fields: PaymentLogFields & LogContext = {},
): LogContext {
  const { service_id, schedule_id, gateway_slug, error_code, ...rest } = fields;
  const context: LogContext = { ...rest };

  if (service_id) {
    context.service_id = service_id;
    context.correlation_id = service_id;
  }

  if (schedule_id) {
    context.schedule_id = schedule_id;
  }

  if (gateway_slug) {
    context.gateway_slug = gateway_slug;
  }

  if (error_code) {
    context.error_code = error_code;
  }

  return sanitizePaymentLogContext(context);
}

export function buildWebhookLogContext(
  fields: {
    event_type: string;
    gateway_event_id: string;
    gateway_slug?: string;
    service_id?: string;
    processing_duration_ms?: number;
    outcome?: string;
  } & LogContext,
): LogContext {
  const {
    event_type,
    gateway_event_id,
    gateway_slug = "netcred",
    service_id,
    processing_duration_ms,
    outcome,
    ...rest
  } = fields;

  const context = buildPaymentLogContext({
    ...rest,
    service_id,
    gateway_slug,
  });

  context.event_type = event_type;
  context.gateway_event_id = gateway_event_id;

  if (processing_duration_ms !== undefined) {
    context.processing_duration_ms = processing_duration_ms;
  }

  if (outcome !== undefined) {
    context.outcome = outcome;
  }

  if (!context.correlation_id) {
    context.correlation_id = gateway_event_id;
  }

  return context;
}

function wrapLogger(base: EdgeLogger): EdgeLogger {
  return {
    debug: (event, context) =>
      base.debug(event, buildPaymentLogContext(context)),
    info: (event, context) => base.info(event, buildPaymentLogContext(context)),
    warn: (event, context) => base.warn(event, buildPaymentLogContext(context)),
    error: (event, context) =>
      base.error(event, buildPaymentLogContext(context)),
  };
}

export function createPaymentLogger(scope: string): EdgeLogger {
  return wrapLogger(createLogger(scope));
}
