import type { FormBlock, FormBlockType, FormSchema } from "../types/schema";
import { COMPLETION_CHECKLIST_BLOCK_TYPES } from "../types/schema";

export type CompletionChecklistValidationResult = {
  valid: boolean;
  errors: string[];
  criterionCount: number;
};

/**
 * Client-side allowlist + cardinality mirror of enrichment_validate_checklist_schema.
 * static_text does not count toward criterion cardinality.
 */
export function validateCompletionChecklistSchema(
  schema: Pick<FormSchema, "steps">,
  options?: { criterionMin?: number; criterionMax?: number },
): CompletionChecklistValidationResult {
  const criterionMin = options?.criterionMin ?? 3;
  const criterionMax = options?.criterionMax ?? 12;
  const errors: string[] = [];
  let criterionCount = 0;
  const allowed = new Set<string>(COMPLETION_CHECKLIST_BLOCK_TYPES);

  for (const step of schema.steps ?? []) {
    for (const block of step.blocks ?? []) {
      if (!allowed.has(block.type)) {
        errors.push(
          `Tipo de bloco não permitido no checklist: "${block.type}" (id=${block.id})`,
        );
        continue;
      }
      if (block.type === "completion_criterion") {
        criterionCount += 1;
        if (!block.label?.trim()) {
          errors.push(`Critério "${block.id}" sem label`);
        }
        const cfg = block.config as Record<string, unknown> | undefined;
        if (!cfg || typeof cfg.requires_evidence_when_met !== "boolean") {
          errors.push(
            `Critério "${block.id}" precisa de config.requires_evidence_when_met`,
          );
        }
      }
    }
  }

  if (criterionCount < criterionMin || criterionCount > criterionMax) {
    errors.push(
      `Checklist precisa de ${criterionMin}–${criterionMax} critérios (encontrou ${criterionCount})`,
    );
  }

  return { valid: errors.length === 0, errors, criterionCount };
}

export function isCompletionChecklistBlockType(type: FormBlockType): boolean {
  return (COMPLETION_CHECKLIST_BLOCK_TYPES as readonly string[]).includes(type);
}

export function countCompletionCriteria(blocks: FormBlock[]): number {
  return blocks.filter((b) => b.type === "completion_criterion").length;
}
