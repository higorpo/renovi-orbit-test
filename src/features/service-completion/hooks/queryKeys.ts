export const SERVICE_COMPLETION_CONTEXT_QUERY_KEY = [
  "service-completion",
  "context",
] as const;

export function serviceCompletionContextQueryKey(serviceRequestId: string) {
  return [...SERVICE_COMPLETION_CONTEXT_QUERY_KEY, serviceRequestId] as const;
}
