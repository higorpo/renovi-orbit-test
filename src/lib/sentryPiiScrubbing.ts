import type { ErrorEvent } from "@sentry/react";

const PII_KEYS = new Set([
  "email",
  "phone",
  "name",
  "full_name",
  "address",
  "street",
  "cep",
  "postal_code",
  "notes",
  "password",
  "token",
  // CHD / payment cardholder data (CHK-031)
  "cardnumber",
  "card_number",
  "cvv",
  "cvc",
  "securitycode",
  "security_code",
  "pan",
  "carddata",
  "card_data",
  "cardholdername",
  "cardholder_name",
  "cpf",
  "document",
  "billingaddress",
  "billing_address",
  "gateway_card_token",
  "gatewaycardtoken",
]);

const REDACTED = "[redacted]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function scrubSensitiveData(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubSensitiveData(item, keys));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key.toLowerCase())) {
      scrubbed[key] = REDACTED;
      continue;
    }

    scrubbed[key] = scrubSensitiveData(nested, keys);
  }

  return scrubbed;
}

export function scrubPiiData(value: unknown): unknown {
  return scrubSensitiveData(value, PII_KEYS);
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = { ...event };

  if (next.extra) {
    next.extra = scrubPiiData(next.extra) as Record<string, unknown>;
  }

  if (next.contexts) {
    next.contexts = scrubPiiData(next.contexts) as ErrorEvent["contexts"];
  }

  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: breadcrumb.data
        ? (scrubPiiData(breadcrumb.data) as Record<string, unknown>)
        : breadcrumb.data,
    }));
  }

  return next;
}

export function scrubSentryBreadcrumbData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) return data;
  return scrubPiiData(data) as Record<string, unknown>;
}
