import type { StructuredAIResponse } from "./types.ts";
import {
  filterAllowedEquipment,
  filterAllowedMaterials,
  parseDurationHint,
} from "./allowedValues.ts";

/**
 * Strip markdown code fence around JSON (e.g. ```json ... ```) so it can be parsed.
 */
export function stripJsonCodeFence(raw: string): string {
  let s = raw.trim();
  const open = /^```(?:json)?\s*\n?/i;
  const close = /\n?```\s*$/;
  if (open.test(s)) s = s.replace(open, "");
  if (close.test(s)) s = s.replace(close, "");
  return s.trim();
}

/**
 * If the model returned the full JSON inside professional_description (nested JSON),
 * unwrap it and return an object that has the actual text in professional_description.
 */
export function unwrapNestedStructuredResponse(
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const desc = parsed.professional_description;
  if (typeof desc !== "string" || !desc.trim().startsWith("{")) {
    return parsed;
  }
  try {
    const inner = JSON.parse(desc) as Record<string, unknown>;
    if (inner && typeof inner.professional_description === "string") {
      return {
        ...parsed,
        professional_description: inner.professional_description,
      };
    }
  } catch {
    // not valid JSON or wrong shape, use original
  }
  return parsed;
}

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
    if (typeof d.suggested_title !== "string") return null;
    if (!Array.isArray(d.tags)) return null;
    if (!Array.isArray(d.missing_info_warnings)) return null;
    if (!["low", "medium", "high"].includes(d.urgency as string)) return null;
    if (
      !["simple", "medium", "complex"].includes(d.scope_complexity as string)
    ) {
      return null;
    }

    const suggested_equipment = Array.isArray(d.suggested_equipment)
      ? filterAllowedEquipment(d.suggested_equipment as string[])
      : [];
    const suggested_materials = Array.isArray(d.suggested_materials)
      ? filterAllowedMaterials(d.suggested_materials as string[])
      : [];
    const estimated_duration_hint = parseDurationHint(
      d.estimated_duration_hint as string | null | undefined
    );

    return {
      schema_version: (d.schema_version as number) || 1,
      professional_description: (d.professional_description as string) || "",
      suggested_title: (d.suggested_title as string).trim(),
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      missing_info_warnings: Array.isArray(d.missing_info_warnings)
        ? (d.missing_info_warnings as string[])
        : [],
      urgency: (d.urgency as "low" | "medium" | "high") || "medium",
      scope_complexity:
        (d.scope_complexity as "simple" | "medium" | "complex") || "medium",
      confidence:
        typeof d.confidence === "number"
          ? Math.max(0, Math.min(1, d.confidence))
          : 0.7,
      recommended_next_step:
        (d.recommended_next_step as
          | "ask_questions"
          | "schedule_visit"
          | "send_estimate_range") || "send_estimate_range",
      suggested_equipment,
      suggested_materials,
      estimated_duration_hint,
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
  description: string
): StructuredAIResponse {
  return {
    schema_version: 1,
    professional_description: description,
    suggested_title: "Pedido de Serviço",
    tags: [],
    missing_info_warnings: [],
    urgency: "medium",
    scope_complexity: "medium",
    confidence: 0.5,
    recommended_next_step: "send_estimate_range",
    suggested_equipment: [],
    suggested_materials: [],
    estimated_duration_hint: null,
  };
}
