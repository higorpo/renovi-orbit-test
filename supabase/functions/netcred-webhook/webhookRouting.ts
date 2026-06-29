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

export function isHeavyPathEventType(eventType: string): boolean {
  return eventType === "TRANSACTION_UPDATE";
}

export function isIgnorableIngressEvent(eventType: string): boolean {
  return eventType === "WEBHOOK_PING";
}
