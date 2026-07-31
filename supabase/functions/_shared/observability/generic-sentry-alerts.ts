/**
 * Generic SQL→Edge→Sentry alert capture (level + message contract).
 * Payment-specific kinds stay in payment-sentry-matrix.ts.
 */

import {
  dispatchPaymentSentryAlerts,
  type PaymentSentryAlert,
  type RecordedSentryMessage,
} from "./payment-sentry-matrix.ts";

export type GenericSentryAlert = {
  level: string;
  message: string;
  code?: string;
  count?: number;
  [key: string]: unknown;
};

export type OrbitSentryAlertItem = PaymentSentryAlert | GenericSentryAlert;

const PAYMENT_ALERT_KINDS = new Set<PaymentSentryAlert["kind"]>([
  "auto_cancel",
  "webhook_dead_letter",
  "transaction_dispute",
  "webhook_auth_fail_spike",
  "failed_permanent_spike",
]);

let testMessageRecorder: ((record: RecordedSentryMessage) => void) | null = null;

export function setGenericSentryRecordersForTests(options: {
  onMessage?: ((record: RecordedSentryMessage) => void) | null;
}): void {
  testMessageRecorder = options.onMessage ?? null;
}

function getDsn(): string | undefined {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  return dsn || undefined;
}

/** Map CRITICAL/critical/fatal → fatal; everything else → warning. */
export function mapGenericSentryLevel(
  level: string,
): "warning" | "fatal" {
  const normalized = level.trim().toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "fatal"
  ) {
    return "fatal";
  }
  return "warning";
}

export function isPaymentSentryAlert(
  alert: unknown,
): alert is PaymentSentryAlert {
  if (!alert || typeof alert !== "object") return false;
  const kind = (alert as { kind?: unknown }).kind;
  return typeof kind === "string" &&
    PAYMENT_ALERT_KINDS.has(kind as PaymentSentryAlert["kind"]);
}

export function isGenericSentryAlert(
  alert: unknown,
): alert is GenericSentryAlert {
  if (!alert || typeof alert !== "object") return false;
  const record = alert as Record<string, unknown>;
  return typeof record.message === "string" &&
    typeof record.level === "string" &&
    record.message.length > 0;
}

export async function emitGenericSentryAlert(
  alert: GenericSentryAlert,
): Promise<void> {
  const sentryLevel = mapGenericSentryLevel(alert.level);
  const { level: _level, message, ...rest } = alert;

  const tags: Record<string, string> = {};
  if (typeof rest.code === "string" && rest.code.length > 0) {
    tags.code = rest.code;
  }

  const extra: Record<string, unknown> = { ...rest };

  testMessageRecorder?.({
    level: sentryLevel,
    message,
    tags,
    extra,
  });

  const dsn = getDsn();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/deno");
    Sentry.captureMessage(message, { level: sentryLevel, tags, extra });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}

/**
 * Hybrid dispatcher: known payment `kind` → matrix; else level+message → generic.
 */
export async function dispatchOrbitSentryAlerts(
  alerts: unknown[],
): Promise<number> {
  let dispatched = 0;

  for (const alert of alerts) {
    if (isPaymentSentryAlert(alert)) {
      dispatched += await dispatchPaymentSentryAlerts([alert]);
      continue;
    }

    if (isGenericSentryAlert(alert)) {
      await emitGenericSentryAlert(alert);
      dispatched += 1;
    }
  }

  return dispatched;
}
