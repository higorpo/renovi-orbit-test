/** Resend webhook event envelope (design §5.6). Full parsing wired in task 78. */

export interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data?: Record<string, unknown>;
}

export function parseResendWebhookPayload(raw: string): ResendWebhookEvent | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ResendWebhookEvent;
    if (!parsed?.type || typeof parsed.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
