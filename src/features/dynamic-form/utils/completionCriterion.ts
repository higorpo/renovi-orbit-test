import type {
  FormBlock,
  CompletionCriterionBlockConfig,
  CompletionCriterionValue,
} from "../types/schema";

export const DEFAULT_EVIDENCE_MIN = 1;
export const DEFAULT_EVIDENCE_MAX = 5;

export function getCompletionCriterionConfig(
  block: FormBlock,
): Required<CompletionCriterionBlockConfig> {
  const raw = (block.config ?? {}) as Partial<CompletionCriterionBlockConfig>;
  const evidence_min =
    typeof raw.evidence_min === "number" && Number.isFinite(raw.evidence_min)
      ? Math.max(1, Math.floor(raw.evidence_min))
      : DEFAULT_EVIDENCE_MIN;
  const evidence_maxRaw =
    typeof raw.evidence_max === "number" && Number.isFinite(raw.evidence_max)
      ? Math.floor(raw.evidence_max)
      : DEFAULT_EVIDENCE_MAX;
  const evidence_max = Math.max(evidence_min, evidence_maxRaw);

  return {
    requires_evidence_when_met: Boolean(raw.requires_evidence_when_met),
    evidence_min,
    evidence_max,
  };
}

export function isCompletionCriterionValue(
  value: unknown,
): value is CompletionCriterionValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.met === "boolean" && Array.isArray(v.evidence_paths);
}

export function validateCompletionCriterionValue(
  block: FormBlock,
  value: unknown,
): { valid: boolean; error?: string } {
  const required = block.required !== false;

  if (value === undefined || value === null) {
    if (!required) return { valid: true };
    return { valid: false, error: block.validation?.message || "Responda o critério" };
  }

  if (!isCompletionCriterionValue(value)) {
    return { valid: false, error: "Resposta do critério inválida" };
  }

  const config = getCompletionCriterionConfig(block);
  const paths = value.evidence_paths.filter(
    (p) => typeof p === "string" && p.trim().length > 0,
  );

  if (value.met === false) {
    const justification =
      typeof value.justification === "string" ? value.justification.trim() : "";
    if (!justification) {
      return {
        valid: false,
        error: "Informe a justificativa quando o critério não for atendido",
      };
    }
    if (paths.length < config.evidence_min) {
      return {
        valid: false,
        error: `Anexe pelo menos ${config.evidence_min} foto(s)`,
      };
    }
    if (paths.length > config.evidence_max) {
      return {
        valid: false,
        error: `No máximo ${config.evidence_max} foto(s)`,
      };
    }
    return { valid: true };
  }

  // met === true
  if (config.requires_evidence_when_met) {
    if (paths.length < config.evidence_min) {
      return {
        valid: false,
        error: `Anexe pelo menos ${config.evidence_min} foto(s)`,
      };
    }
    if (paths.length > config.evidence_max) {
      return {
        valid: false,
        error: `No máximo ${config.evidence_max} foto(s)`,
      };
    }
  } else if (paths.length > config.evidence_max) {
    return {
      valid: false,
      error: `No máximo ${config.evidence_max} foto(s)`,
    };
  }

  return { valid: true };
}
