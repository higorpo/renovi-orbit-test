import type { FormStep } from "../../types";
import type { SchemaValidationError, StepValidationResult } from "./types";
import { validateBlocks } from "./blockValidator";

export function validateSteps(steps: FormStep[]): StepValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const stepIds = new Set<string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const path = `steps[${i}]`;

    if (!step.id) {
      errors.push({
        code: "STEP_MISSING_ID",
        message: `Step ${i} has no ID`,
        path,
        severity: "error",
      });
    } else if (stepIds.has(step.id)) {
      errors.push({
        code: "DUPLICATE_STEP_ID",
        message: `Duplicate step ID: "${step.id}"`,
        path,
        severity: "error",
      });
    } else {
      stepIds.add(step.id);
    }

    if (typeof step.order !== "number") {
      errors.push({
        code: "STEP_MISSING_ORDER",
        message: `Step "${step.id}" has no numeric order`,
        path,
        severity: "error",
      });
    }

    if (!step.title || typeof step.title !== "string") {
      errors.push({
        code: "STEP_MISSING_TITLE",
        message: `Step "${step.id}" has no title`,
        path,
        severity: "error",
      });
    }

    if (!Array.isArray(step.blocks) || step.blocks.length === 0) {
      errors.push({
        code: "STEP_NO_BLOCKS",
        message: `Step "${step.id}" has no blocks`,
        path,
        severity: "error",
      });
      continue;
    }

    const blockResult = validateBlocks(step.blocks, step.id, path);
    errors.push(...blockResult.errors);
    warnings.push(...blockResult.warnings);
  }

  return { errors, warnings };
}
