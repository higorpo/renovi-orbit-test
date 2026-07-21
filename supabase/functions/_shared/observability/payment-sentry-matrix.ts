/**
 * Payment Sentry severity matrix (design.md §10.1, Req 21).
 */

export type PaymentExceptionContext = {
  schedule_id?: string;
  contracted_service_id?: string;
  automatic_attempt_count?: number;
  gateway_slug?: string;
  error_code?: string;
  current_state?: string;
};

export type AutoCancelWarningContext = {
  service_id: string;
  schedule_id: string;
  last_failure_reason?: string | null;
};

export type WebhookDeadLetterContext = {
  event_id: string;
  event_type: string;
  gateway_event_id?: string | null;
  schedule_id?: string | null;
  failure_reason?: string | null;
  retry_count?: number;
};

export type WebhookAuthFailSpikeContext = {
  count_15m: number;
  threshold: number;
};

export type FailedPermanentSpikeContext = {
  count_15m: number;
  threshold: number;
};

export type TransactionDisputeContext = {
  schedule_id: string;
  service_id: string;
  event_id?: string;
  gateway_transaction_id?: string | null;
};

export type PaymentSentryAlert =
  | ({ kind: "auto_cancel" } & AutoCancelWarningContext)
  | ({ kind: "webhook_dead_letter" } & WebhookDeadLetterContext)
  | ({ kind: "webhook_auth_fail_spike" } & WebhookAuthFailSpikeContext)
  | ({ kind: "failed_permanent_spike" } & FailedPermanentSpikeContext)
  | ({ kind: "transaction_dispute" } & TransactionDisputeContext);

export type RecordedSentryMessage = {
  level: "warning" | "fatal";
  message: string;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
};

export type RecordedSentryException = {
  error: unknown;
  extra: Record<string, unknown>;
  tags: Record<string, string>;
};

let testMessageRecorder: ((record: RecordedSentryMessage) => void) | null = null;
let testExceptionRecorder: ((record: RecordedSentryException) => void) | null = null;

export function setPaymentSentryRecordersForTests(options: {
  onMessage?: ((record: RecordedSentryMessage) => void) | null;
  onException?: ((record: RecordedSentryException) => void) | null;
}): void {
  testMessageRecorder = options.onMessage ?? null;
  testExceptionRecorder = options.onException ?? null;
}

function getDsn(): string | undefined {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  return dsn || undefined;
}

function stringTags(
  entries: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value != null && value !== "") {
      tags[key] = String(value);
    }
  }
  return tags;
}

async function captureMessage(
  message: string,
  level: "warning" | "fatal",
  extra: Record<string, unknown> = {},
  tagKeys: string[] = [],
): Promise<void> {
  const tags: Record<string, string> = {};
  for (const key of tagKeys) {
    const value = extra[key];
    if (typeof value === "string" && value.length > 0) {
      tags[key] = value;
    }
  }

  testMessageRecorder?.({ level, message, tags, extra });

  const dsn = getDsn();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/deno");
    Sentry.captureMessage(message, { level, tags, extra });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}

export async function capturePaymentException(
  error: unknown,
  context: PaymentExceptionContext,
): Promise<void> {
  const extra: Record<string, unknown> = {
    schedule_id: context.schedule_id,
    contracted_service_id: context.contracted_service_id,
    automatic_attempt_count: context.automatic_attempt_count,
    gateway_slug: context.gateway_slug ?? "netcred",
    error_code: context.error_code,
    current_state: context.current_state,
    error: error instanceof Error ? error.message : String(error),
  };

  const tags = stringTags({
    service_id: context.contracted_service_id,
    schedule_id: context.schedule_id,
    gateway_slug: context.gateway_slug ?? "netcred",
  });

  testExceptionRecorder?.({ error, extra, tags });

  const dsn = getDsn();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/deno");
    Sentry.withScope((scope) => {
      scope.setTags(tags);
      scope.setExtras(extra);
      Sentry.captureException(error);
    });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}

export function capturePaymentExceptionSync(
  error: unknown,
  context: PaymentExceptionContext,
): void {
  void capturePaymentException(error, context);
}

export async function emitFailedPermanentTransitionWarning(input: {
  service_id: string;
  schedule_id: string;
  gateway_slug?: string;
  failure_codes: string[];
}): Promise<void> {
  await captureMessage(
    "payment_schedule_failed_permanent",
    "warning",
    {
      service_id: input.service_id,
      schedule_id: input.schedule_id,
      gateway_slug: input.gateway_slug ?? "netcred",
      failure_codes: input.failure_codes,
    },
    ["service_id", "schedule_id", "gateway_slug"],
  );
}

export async function emitAutoCancelCommittedWarning(
  input: AutoCancelWarningContext,
): Promise<void> {
  await captureMessage(
    "payment_service_auto_cancelled",
    "warning",
    {
      service_id: input.service_id,
      schedule_id: input.schedule_id,
      last_failure_reason: input.last_failure_reason ?? null,
    },
    ["service_id", "schedule_id"],
  );
}

export async function emitInvalidWebhookSignatureWarning(extra: {
  event_type: string;
  gateway_event_id?: string;
  source_ip?: string;
  event_id?: string;
}): Promise<void> {
  await captureMessage(
    "webhook_invalid_signature",
    "warning",
    extra,
    ["event_type"],
  );
}

export async function emitMissingClearSaleSessionWarning(input: {
  schedule_id: string;
  service_id?: string;
}): Promise<void> {
  await captureMessage(
    "missing_clearsale_session_id",
    "warning",
    {
      schedule_id: input.schedule_id,
      service_id: input.service_id,
      reason: "MISSING_CLEARSALE_SESSION_ID",
    },
    ["schedule_id"],
  );
}

export async function emitProviderMultipleEdgesWarning(extra: {
  document_suffix: string;
  edges_count: number;
}): Promise<void> {
  await captureMessage(
    "provider_multiple_company_edges",
    "warning",
    extra,
    [],
  );
}

export async function emitWebhookAuthFailSpikeWarning(
  input: WebhookAuthFailSpikeContext,
): Promise<void> {
  await captureMessage(
    "payment_webhook_auth_fail_spike",
    "warning",
    {
      count_15m: input.count_15m,
      threshold: input.threshold,
      window: "15m",
    },
    [],
  );
}

export async function emitFailedPermanentSpikeWarning(
  input: FailedPermanentSpikeContext,
): Promise<void> {
  await captureMessage(
    "payment_failed_permanent_spike",
    "warning",
    {
      count_15m: input.count_15m,
      threshold: input.threshold,
      window: "15m",
    },
    [],
  );
}

export async function emitReconciliationFailureWarning(extra: {
  schedule_id: string;
  service_id: string;
  reconciliation_failure_count: number;
}): Promise<void> {
  await captureMessage(
    "payment_reconciliation_failure_threshold",
    "warning",
    extra,
    ["schedule_id", "service_id"],
  );
}

export const CRITICAL_ALERTS = {
  NETCRED_AUTH_FAILURE: "NETCRED_AUTH_FAILURE",
  WEBHOOK_DEAD_LETTER: "WEBHOOK_DEAD_LETTER",
  SANDBOX_CREDENTIALS_IN_PRODUCTION: "SANDBOX_CREDENTIALS_IN_PRODUCTION",
  /** Gateway succeeded (or reconcile confirmed) but payment_commit_charge_outcome still fails. */
  CHARGE_COMMIT_AFTER_SUCCESS_FAILED: "CHARGE_COMMIT_AFTER_SUCCESS_FAILED",
  TRANSACTION_DISPUTE: "TRANSACTION_DISPUTE",
} as const;

export async function captureCriticalAlert(
  message: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await captureMessage(message, "fatal", extra, [
    "gateway_slug",
    "error_type",
    "event_type",
  ]);
}

export function captureCriticalAlertSync(
  message: string,
  extra: Record<string, unknown> = {},
): void {
  void captureCriticalAlert(message, extra);
}

export function captureNetcredAuthFailureCritical(
  error: unknown,
  extra: Record<string, unknown> = {},
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.NETCRED_AUTH_FAILURE, {
    gateway_slug: "netcred",
    error_type: "AUTH_FAILURE",
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}

export function captureSandboxCredentialsCritical(
  extra: Record<string, unknown> = {},
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.SANDBOX_CREDENTIALS_IN_PRODUCTION, {
    gateway_slug: "netcred",
    error_type: "SANDBOX_CREDENTIALS",
    ...extra,
  });
}

export function captureWebhookDeadLetterCritical(
  extra: WebhookDeadLetterContext,
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.WEBHOOK_DEAD_LETTER, extra);
}

export function captureTransactionDisputeCritical(
  extra: TransactionDisputeContext,
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.TRANSACTION_DISPUTE, {
    error_type: "TRANSACTION_DISPUTE",
    ...extra,
  });
}

export function createNetcredCaptureCriticalHook(): (
  message: string,
  extra?: Record<string, unknown>,
) => void {
  return (message, extra = {}) => {
    if (message === CRITICAL_ALERTS.NETCRED_AUTH_FAILURE) {
      captureNetcredAuthFailureCritical(extra.error ?? message, extra);
      return;
    }

    if (message === CRITICAL_ALERTS.SANDBOX_CREDENTIALS_IN_PRODUCTION) {
      captureSandboxCredentialsCritical(extra);
      return;
    }

    captureCriticalAlertSync(message, extra);
  };
}

export async function dispatchPaymentSentryAlerts(
  alerts: PaymentSentryAlert[],
): Promise<number> {
  let dispatched = 0;

  for (const alert of alerts) {
    switch (alert.kind) {
      case "auto_cancel":
        await emitAutoCancelCommittedWarning(alert);
        dispatched += 1;
        break;
      case "webhook_dead_letter":
        captureWebhookDeadLetterCritical(alert);
        dispatched += 1;
        break;
      case "transaction_dispute":
        captureTransactionDisputeCritical(alert);
        dispatched += 1;
        break;
      case "webhook_auth_fail_spike":
        await emitWebhookAuthFailSpikeWarning(alert);
        dispatched += 1;
        break;
      case "failed_permanent_spike":
        await emitFailedPermanentSpikeWarning(alert);
        dispatched += 1;
        break;
    }
  }

  return dispatched;
}
