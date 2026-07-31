import {
  isPayoutEventType,
  PAYOUT_INLINE_MAX_MOVEMENTS,
} from "./parsePayoutPayload.ts";

export type ProcessWebhookRpcResult = {
  outcome: string;
  event_id?: string;
  handler?: { outcome?: string; reason?: string };
};

export function shouldEnqueueAfterProcess(result: ProcessWebhookRpcResult): boolean {
  if (result.outcome === "retry_scheduled") {
    return true;
  }

  const handlerOutcome = result.handler?.outcome;
  return handlerOutcome === "skipped" || handlerOutcome === "not_found";
}

export function isHeavyPathEventType(
  eventType: string,
  payload?: Record<string, unknown>,
): boolean {
  if (eventType === "TRANSACTION_UPDATE") {
    return true;
  }

  if (!isPayoutEventType(eventType)) {
    return false;
  }

  const movements = payload?.movements;
  if (!Array.isArray(movements)) {
    return false;
  }

  return movements.length > PAYOUT_INLINE_MAX_MOVEMENTS;
}

export function isIgnorableIngressEvent(eventType: string): boolean {
  return eventType === "WEBHOOK_PING";
}
