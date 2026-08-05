/**
 * Classify enrichment LLM / schema failures (Task 29).
 * Transient → schedule_retry; validation → retry then fallback; fatal → fallback/ops.
 */

export type EnrichmentErrorClass = "transient" | "validation" | "fatal";

export type ClassifiedEnrichmentError = {
  class: EnrichmentErrorClass;
  retryable: boolean;
  code: string;
};

const VALIDATION_PREFIXES = [
  "LLM_SCHEMA_",
  "EDGE_VALIDATE_",
  "INVALID_CHECKLIST_SCHEMA",
] as const;

const FATAL_CODES = [
  "GEMINI_API_KEY_MISSING",
  "OPENAI_API_KEY_MISSING", // legacy codes still classified
  "SR_CONTEXT_MISSING",
] as const;

function isProviderHttp(code: string, statusPrefix: string): boolean {
  return (
    code.startsWith(`GEMINI_HTTP_${statusPrefix}`) ||
    code.startsWith(`OPENAI_HTTP_${statusPrefix}`)
  );
}

export function classifyEnrichmentError(reason: string): ClassifiedEnrichmentError {
  const code = reason.trim() || "UNKNOWN";

  if (FATAL_CODES.some((f) => code === f || code.startsWith(`${f}:`))) {
    return { class: "fatal", retryable: false, code };
  }

  if (VALIDATION_PREFIXES.some((p) => code.startsWith(p)) || code === "LLM_JSON_PARSE") {
    return { class: "validation", retryable: true, code };
  }

  if (
    code === "LLM_TIMEOUT" ||
    code === "EMPTY_LLM_CONTENT" ||
    isProviderHttp(code, "429") ||
    isProviderHttp(code, "5") ||
    code.startsWith("LLM_ERROR:")
  ) {
    return { class: "transient", retryable: true, code };
  }

  if (/^(GEMINI|OPENAI)_HTTP_4\d\d/.test(code)) {
    // 4xx other than 429 — treat as fatal config/client issues
    return { class: "fatal", retryable: false, code };
  }

  // Default: retryable transient (unknown network/provider)
  return { class: "transient", retryable: true, code };
}
