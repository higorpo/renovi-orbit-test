import type { StructuredAIResponse } from "./types.ts";

/**
 * Validate structured JSON response from AI.
 */
export function validateStructuredResponse(
  data: unknown
): StructuredAIResponse | null {
  try {
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    if (typeof d.professional_description !== "string") return null;
    if (!Array.isArray(d.tags)) return null;
    if (!Array.isArray(d.missing_info_warnings)) return null;
    if (!["low", "medium", "high"].includes(d.urgency as string)) return null;
    if (
      !["simple", "medium", "complex"].includes(d.scope_complexity as string)
    ) {
      return null;
    }

    return {
      schema_version: (d.schema_version as number) || 1,
      professional_description: (d.professional_description as string) || "",
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      missing_info_warnings: Array.isArray(d.missing_info_warnings)
        ? (d.missing_info_warnings as string[])
        : [],
      suggested_questions: Array.isArray(d.suggested_questions)
        ? (d.suggested_questions as string[])
        : [],
      urgency: (d.urgency as 'low' | 'medium' | 'high') || "medium",
      scope_complexity: (d.scope_complexity as 'simple' | 'medium' | 'complex') || "medium",
      confidence:
        typeof d.confidence === "number"
          ? Math.max(0, Math.min(1, d.confidence))
          : 0.7,
      recommended_next_step:
        (d.recommended_next_step as 'ask_questions' | 'schedule_visit' | 'send_estimate_range') || "send_estimate_range",
    };
  } catch (err) {
    console.error("[Validation] Erro ao validar resposta estruturada:", err);
    return null;
  }
}

/**
 * Generate fallback structured response on error.
 */
export function generateFallbackResponse(
  description: string,
): StructuredAIResponse {
  return {
    schema_version: 1,
    professional_description: description,
    tags: [],
    missing_info_warnings: [],
    suggested_questions: [],  
    urgency: "medium",
    scope_complexity: "medium",
    confidence: 0.5,
    recommended_next_step: "send_estimate_range",
  };
}
