export type PersistWebhookInput = {
  gatewaySlug: string;
  eventType: string;
  providerEventId: string;
  rawPayload: Record<string, unknown>;
  rawHeaders: Record<string, string>;
  signatureValidated: boolean;
};

export type PersistWebhookResult =
  | { status: "inserted"; eventId: string }
  | { status: "duplicate"; eventId: string }
  | { status: "quarantined"; eventId: string };

export type WebhookHandlerContext = {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type WebhookHandlerResult = "processed" | "queued";

export type ProcessWebhookRpcResult = {
  outcome: string;
  event_id?: string;
  handler?: {
    outcome?: string;
    reason?: string;
    schedule_id?: string;
    service_id?: string;
    sentry_alert?: {
      kind?: string;
      schedule_id?: string;
      service_id?: string;
      event_id?: string;
      gateway_transaction_id?: string | null;
    };
  };
};

export type NetcredWebhookRunSummary = {
  outcome:
    | "duplicate"
    | "rate_limited"
    | "invalid_signature"
    | "persist_failed"
    | "processed"
    | "queued"
    | "ping";
  event_id?: string;
  event_type: string;
};
