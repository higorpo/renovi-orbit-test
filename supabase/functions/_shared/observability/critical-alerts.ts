export const CRITICAL_ALERTS = {
  NETCRED_AUTH_FAILURE: "NETCRED_AUTH_FAILURE",
  WEBHOOK_DEAD_LETTER: "WEBHOOK_DEAD_LETTER",
  SANDBOX_CREDENTIALS_IN_PRODUCTION: "SANDBOX_CREDENTIALS_IN_PRODUCTION",
} as const;

export type CriticalAlertExtra = Record<string, unknown>;

export async function captureCriticalAlert(
  message: string,
  extra: CriticalAlertExtra = {},
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN")?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/deno");
    const tags: Record<string, string> = {};

    for (const [key, value] of Object.entries(extra)) {
      if (
        typeof value === "string" &&
        (key === "gateway_slug" || key === "error_type" || key === "event_type")
      ) {
        tags[key] = value;
      }
    }

    Sentry.captureMessage(message, {
      level: "fatal",
      tags,
      extra,
    });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}

export function captureCriticalAlertSync(
  message: string,
  extra: CriticalAlertExtra = {},
): void {
  void captureCriticalAlert(message, extra);
}

export function captureNetcredAuthFailureCritical(
  error: unknown,
  extra: CriticalAlertExtra = {},
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.NETCRED_AUTH_FAILURE, {
    gateway_slug: "netcred",
    error_type: "AUTH_FAILURE",
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}

export function captureSandboxCredentialsCritical(
  extra: CriticalAlertExtra = {},
): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.SANDBOX_CREDENTIALS_IN_PRODUCTION, {
    gateway_slug: "netcred",
    error_type: "SANDBOX_CREDENTIALS",
    ...extra,
  });
}

export function captureWebhookDeadLetterCritical(extra: {
  event_id: string;
  event_type: string;
  gateway_event_id?: string;
  schedule_id?: string | null;
  failure_reason?: string | null;
  retry_count?: number;
}): void {
  captureCriticalAlertSync(CRITICAL_ALERTS.WEBHOOK_DEAD_LETTER, extra);
}

export function createNetcredCaptureCriticalHook(): (
  message: string,
  extra?: CriticalAlertExtra,
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
