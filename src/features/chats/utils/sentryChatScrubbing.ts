import type { ErrorEvent } from "@sentry/react";

const CHAT_CONTENT_KEYS = new Set([
  "text",
  "message",
  "body",
  "content",
  "message_body",
  "payload_text",
]);

const REDACTED = "[redacted]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function scrubMessagePayload(payload: unknown): unknown {
  if (!isPlainObject(payload)) return payload;

  const scrubbed: Record<string, unknown> = { ...payload };
  if ("text" in scrubbed) {
    scrubbed.text = REDACTED;
  }
  return scrubbed;
}

export function scrubChatSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scrubChatSensitiveData(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "payload") {
      scrubbed[key] = scrubMessagePayload(nested);
      continue;
    }

    if (CHAT_CONTENT_KEYS.has(normalizedKey)) {
      scrubbed[key] = REDACTED;
      continue;
    }

    scrubbed[key] = scrubChatSensitiveData(nested);
  }

  return scrubbed;
}

export function scrubChatSentryEvent(event: ErrorEvent): ErrorEvent {
  const next: ErrorEvent = { ...event };

  if (next.extra) {
    next.extra = scrubChatSensitiveData(next.extra) as Record<string, unknown>;
  }

  if (next.contexts) {
    next.contexts = scrubChatSensitiveData(next.contexts) as ErrorEvent["contexts"];
  }

  if (next.breadcrumbs) {
    next.breadcrumbs = next.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: breadcrumb.data
        ? (scrubChatSensitiveData(breadcrumb.data) as Record<string, unknown>)
        : breadcrumb.data,
    }));
  }

  return next;
}

export function scrubChatBreadcrumbData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) return data;
  return scrubChatSensitiveData(data) as Record<string, unknown>;
}

export function isChatSentryFeature(tags: Record<string, unknown> | undefined): boolean {
  return tags?.feature === "chats";
}
