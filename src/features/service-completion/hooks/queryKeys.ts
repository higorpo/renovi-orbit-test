export const SERVICE_COMPLETION_CONTEXT_QUERY_KEY = [
  "service-completion",
  "context",
] as const;

export function serviceCompletionContextQueryKey(serviceRequestId: string) {
  return [...SERVICE_COMPLETION_CONTEXT_QUERY_KEY, serviceRequestId] as const;
}

export const PENDING_EVALUATION_PROMPT_QUERY_KEY = [
  "service-completion",
  "pending-evaluation-prompt",
] as const;

export function pendingEvaluationPromptQueryKey(userId: string) {
  return [...PENDING_EVALUATION_PROMPT_QUERY_KEY, userId] as const;
}
