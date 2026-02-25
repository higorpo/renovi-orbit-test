/**
 * Helper functions for FormSchema V2 (visibility, micro-steps, validation).
 */

import type {
  FormBlockV2,
  FormStepV2,
  FormSchemaV2,
  FormDataV2,
  MicroStep,
  VisibilityRule,
} from "./types";

export function checkVisibilityRule(rule: VisibilityRule, formData: FormDataV2): boolean {
  const fieldValue = formData[rule.dependsOn];
  const { operator, value } = rule;

  switch (operator) {
    case "equals":
      return fieldValue === value;
    case "notEquals":
      return fieldValue !== value;
    case "in":
      return Array.isArray(value) && (value as unknown[]).includes(fieldValue);
    case "notIn":
      return Array.isArray(value) && !(value as unknown[]).includes(fieldValue);
    case "includes":
      return Array.isArray(fieldValue) && fieldValue.includes(value);
    case "notIncludes":
      return Array.isArray(fieldValue) && !fieldValue.includes(value);
    case "greaterThan":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue > value;
    case "lessThan":
      return typeof fieldValue === "number" && typeof value === "number" && fieldValue < value;
    case "isEmpty":
      return (
        !fieldValue ||
        (Array.isArray(fieldValue) && fieldValue.length === 0) ||
        fieldValue === ""
      );
    case "isNotEmpty":
      return (
        !!fieldValue &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0) &&
        fieldValue !== ""
      );
    default:
      return true;
  }
}

export function isBlockVisible(block: FormBlockV2, formData: FormDataV2): boolean {
  if (!block.visibility || block.visibility.length === 0) return true;
  return block.visibility.every((rule) => checkVisibilityRule(rule, formData));
}

export function isStepVisible(step: FormStepV2, formData: FormDataV2): boolean {
  if (!step.visibility || step.visibility.length === 0) return true;
  return step.visibility.every((rule) => checkVisibilityRule(rule, formData));
}

export function getVisibleStepsV2(schema: FormSchemaV2, formData: FormDataV2): FormStepV2[] {
  return schema.steps.filter((step) => isStepVisible(step, formData)).sort((a, b) => a.order - b.order);
}

export function getVisibleBlocksV2(
  step: FormStepV2,
  formData: FormDataV2
): FormBlockV2[] {
  return step.blocks.filter((block) => isBlockVisible(block, formData));
}

export function generateMicroSteps(
  schema: FormSchemaV2,
  formData: FormDataV2
): MicroStep[] {
  const visibleSteps = getVisibleStepsV2(schema, formData);
  const microSteps: MicroStep[] = [];
  let totalBlocks = 0;

  visibleSteps.forEach((step) => {
    getVisibleBlocksV2(step, formData).forEach((block) => {
      if (block.type !== "conditional_alert" && block.type !== "static_text") totalBlocks++;
    });
  });

  let currentIndex = 0;
  visibleSteps.forEach((step) => {
    getVisibleBlocksV2(step, formData).forEach((block) => {
      if (block.type === "conditional_alert" || block.type === "static_text") return;
      microSteps.push({
        index: currentIndex,
        stepId: step.id,
        stepTitle: step.title,
        stepIcon: step.icon,
        stepDescription: step.description,
        blockId: block.id,
        block,
        progress: { current: currentIndex + 1, total: totalBlocks },
      });
      currentIndex++;
    });
  });

  return microSteps;
}

export function isBlockComplete(block: FormBlockV2, formData: FormDataV2): boolean {
  const value = formData[block.id];
  const result = validateBlock(block, value);
  return result.valid;
}

export function isMicroStepComplete(microStep: MicroStep, formData: FormDataV2): boolean {
  return isBlockComplete(microStep.block, formData);
}

export function isStepCompleteV2(step: FormStepV2, formData: FormDataV2): boolean {
  const visibleBlocks = getVisibleBlocksV2(step, formData);
  return visibleBlocks.every((block) => {
    if (block.type === "conditional_alert" || block.type === "static_text") return true;
    return isBlockComplete(block, formData);
  });
}

export function getFormProgress(schema: FormSchemaV2, formData: FormDataV2): number {
  const microSteps = generateMicroSteps(schema, formData);
  if (microSteps.length === 0) return 0;
  const completed = microSteps.filter((ms) => isMicroStepComplete(ms, formData)).length;
  return Math.round((completed / microSteps.length) * 100);
}

export function validateBlock(
  block: FormBlockV2,
  value: unknown
): { valid: boolean; error?: string } {
  if (block.type === "static_text") return { valid: true };

  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    if (!block.required) return { valid: true };
    return { valid: false, error: block.validation?.message || "Campo obrigatório" };
  }

  if (block.validation) {
    const { min, max, minLength, maxLength, pattern, dateMin, dateMax, timeMin, timeMax } = block.validation;
    if (typeof value === "number") {
      const minVal = min ?? block.min;
      const maxVal = max ?? block.max;
      if (minVal !== undefined && value < minVal) return { valid: false, error: `Valor mínimo: ${minVal}` };
      if (maxVal !== undefined && value > maxVal) return { valid: false, error: `Valor máximo: ${maxVal}` };
    }
    if (typeof value === "string") {
      if (minLength !== undefined && value.length < minLength) {
        return { valid: false, error: `Mínimo de ${minLength} caracteres` };
      }
      if (maxLength !== undefined && value.length > maxLength) {
        return { valid: false, error: `Máximo de ${maxLength} caracteres` };
      }
      if (pattern && !new RegExp(pattern).test(value)) {
        return { valid: false, error: block.validation.message || "Formato inválido" };
      }
      if (block.type === "date" && (dateMin !== undefined || dateMax !== undefined)) {
        const v = value as string;
        if (dateMin !== undefined && v < dateMin) {
          return { valid: false, error: block.validation.message || `Data mínima: ${dateMin}` };
        }
        if (dateMax !== undefined && v > dateMax) {
          return { valid: false, error: block.validation.message || `Data máxima: ${dateMax}` };
        }
      }
      if (block.type === "time" && (timeMin !== undefined || timeMax !== undefined)) {
        const v = value as string;
        if (timeMin !== undefined && v < timeMin) {
          return { valid: false, error: block.validation.message || `Horário mínimo: ${timeMin}` };
        }
        if (timeMax !== undefined && v > timeMax) {
          return { valid: false, error: block.validation.message || `Horário máximo: ${timeMax}` };
        }
      }
    }
  }
  if (typeof value === "number" && !block.validation) {
    if (block.min !== undefined && value < block.min) return { valid: false, error: `Valor mínimo: ${block.min}` };
    if (block.max !== undefined && value > block.max) return { valid: false, error: `Valor máximo: ${block.max}` };
  }
  return { valid: true };
}

export function getRelatedAlerts(
  blockId: string,
  step: FormStepV2 | null | undefined,
  formData: FormDataV2
): FormBlockV2[] {
  if (!step?.blocks || !Array.isArray(step.blocks) || !blockId || typeof formData !== "object")
    return [];
  return step.blocks.filter((block) => {
    if (!block || block.type !== "conditional_alert" || !block.visibility?.length) return false;
    const dependsOnBlock = block.visibility.some((rule) => rule?.dependsOn === blockId);
    if (!dependsOnBlock) return false;
    try {
      return isBlockVisible(block, formData);
    } catch {
      return false;
    }
  });
}

/** Find a block by id in the schema (any step). Returns undefined if not found. */
export function getBlockById(
  schema: FormSchemaV2,
  blockId: string
): FormBlockV2 | undefined {
  for (const step of schema.steps) {
    const block = step.blocks.find((b) => b.id === blockId);
    if (block) return block;
  }
  return undefined;
}
