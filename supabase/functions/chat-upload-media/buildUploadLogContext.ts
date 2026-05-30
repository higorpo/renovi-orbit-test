export type UploadLogContextInput = {
  correlationId: string;
  conversationId?: string;
  uploadSessionId?: string;
  idempotencyKey?: string;
  eventType?: string;
};

export function buildUploadLogContext(
  input: UploadLogContextInput,
): Record<string, string | undefined> {
  const context: Record<string, string | undefined> = {
    correlation_id: input.correlationId,
  };

  if (input.conversationId) {
    context.conversation_id = input.conversationId;
  }
  if (input.uploadSessionId) {
    context.upload_session_id = input.uploadSessionId;
  }
  if (input.idempotencyKey) {
    context.idempotency_key = input.idempotencyKey;
  }
  if (input.eventType) {
    context.event_type = input.eventType;
  }

  return context;
}
