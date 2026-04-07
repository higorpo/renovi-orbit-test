import type {
  FormBlock,
  FormStep,
  FormSchema,
  FormData,
  StepBlock,
  VisibilityRule,
} from "./schema";
import {
  DEFAULT_PROPERTY_TYPE_OPTIONS,
  DEFAULT_URGENCY_OPTIONS,
} from "./defaults";

export function evaluateVisibilityRule(rule: VisibilityRule, formData: FormData): boolean {
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

export function isBlockVisible(block: FormBlock, formData: FormData): boolean {
  if (!block.visibility || block.visibility.length === 0) return true;
  return block.visibility.every((rule) => evaluateVisibilityRule(rule, formData));
}

export function isStepVisible(step: FormStep, formData: FormData): boolean {
  if (!step.visibility || step.visibility.length === 0) return true;
  return step.visibility.every((rule) => evaluateVisibilityRule(rule, formData));
}

export function getVisibleSteps(schema: FormSchema, formData: FormData): FormStep[] {
  return schema.steps.filter((step) => isStepVisible(step, formData)).sort((a, b) => a.order - b.order);
}

export function getVisibleBlocks(step: FormStep, formData: FormData): FormBlock[] {
  return step.blocks.filter((block) => isBlockVisible(block, formData));
}

export function buildStepBlocks(schema: FormSchema, formData: FormData): StepBlock[] {
  const visibleSteps = getVisibleSteps(schema, formData);
  const stepBlocks: StepBlock[] = [];
  let totalBlocks = 0;

  visibleSteps.forEach((step) => {
    getVisibleBlocks(step, formData).forEach((block) => {
      if (block.type !== "conditional_alert" && block.type !== "static_text") totalBlocks++;
    });
  });

  let currentIndex = 0;
  visibleSteps.forEach((step) => {
    getVisibleBlocks(step, formData).forEach((block) => {
      if (block.type === "conditional_alert" || block.type === "static_text") return;
      stepBlocks.push({
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

  return stepBlocks;
}

export function isBlockComplete(block: FormBlock, formData: FormData): boolean {
  const value = formData[block.id];
  const result = validateBlockValue(block, value);
  return result.valid;
}

export function isStepBlockComplete(stepBlock: StepBlock, formData: FormData): boolean {
  return isBlockComplete(stepBlock.block, formData);
}

export function isStepComplete(step: FormStep, formData: FormData): boolean {
  const visibleBlocks = getVisibleBlocks(step, formData);
  return visibleBlocks.every((block) => {
    if (block.type === "conditional_alert" || block.type === "static_text") return true;
    return isBlockComplete(block, formData);
  });
}

export function getFormProgress(schema: FormSchema, formData: FormData): number {
  const stepBlocks = buildStepBlocks(schema, formData);
  if (stepBlocks.length === 0) return 0;
  const completed = stepBlocks.filter((sb) => isStepBlockComplete(sb, formData)).length;
  return Math.round((completed / stepBlocks.length) * 100);
}

export type ValidateBlockResult = { valid: boolean; error?: string };

function isValueEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function validateNumberConstraints(
  block: FormBlock,
  value: number
): ValidateBlockResult {
  const validation = block.validation;
  const minVal = validation?.min ?? block.min;
  const maxVal = validation?.max ?? block.max;
  if (minVal !== undefined && value < minVal) {
    return { valid: false, error: `Valor mínimo: ${minVal}` };
  }
  if (maxVal !== undefined && value > maxVal) {
    return { valid: false, error: `Valor máximo: ${maxVal}` };
  }
  return { valid: true };
}

function validateStringConstraints(
  block: FormBlock,
  value: string
): ValidateBlockResult {
  const { minLength, maxLength, pattern, dateMin, dateMax, timeMin, timeMax } =
    block.validation ?? {};
  if (minLength !== undefined && value.length < minLength) {
    return { valid: false, error: `Mínimo de ${minLength} caracteres` };
  }
  if (maxLength !== undefined && value.length > maxLength) {
    return { valid: false, error: `Máximo de ${maxLength} caracteres` };
  }
  if (pattern) {
    if (pattern.length > 500) {
      return { valid: false, error: block.validation?.message || "Formato inválido" };
    }
    try {
      const re = new RegExp(pattern);
      if (!re.test(value)) {
        return { valid: false, error: block.validation?.message || "Formato inválido" };
      }
    } catch {
      return { valid: false, error: block.validation?.message || "Formato inválido" };
    }
  }
  if (block.type === "date" && (dateMin !== undefined || dateMax !== undefined)) {
    if (dateMin !== undefined && value < dateMin) {
      return { valid: false, error: block.validation?.message || `Data mínima: ${dateMin}` };
    }
    if (dateMax !== undefined && value > dateMax) {
      return { valid: false, error: block.validation?.message || `Data máxima: ${dateMax}` };
    }
  }
  if (block.type === "time" && (timeMin !== undefined || timeMax !== undefined)) {
    if (timeMin !== undefined && value < timeMin) {
      return { valid: false, error: block.validation?.message || `Horário mínimo: ${timeMin}` };
    }
    if (timeMax !== undefined && value > timeMax) {
      return { valid: false, error: block.validation?.message || `Horário máximo: ${timeMax}` };
    }
  }
  return { valid: true };
}

export function validateBlockValue(
  block: FormBlock,
  value: unknown
): ValidateBlockResult {
  if (block.type === "static_text") return { valid: true };

  if (isValueEmpty(value)) {
    if (!block.required) return { valid: true };
    return { valid: false, error: block.validation?.message || "Campo obrigatório" };
  }

  if (block.validation) {
    if (typeof value === "number") return validateNumberConstraints(block, value);
    if (typeof value === "string") return validateStringConstraints(block, value);
  }

  if (typeof value === "number" && !block.validation) {
    if (block.min !== undefined && value < block.min) {
      return { valid: false, error: `Valor mínimo: ${block.min}` };
    }
    if (block.max !== undefined && value > block.max) {
      return { valid: false, error: `Valor máximo: ${block.max}` };
    }
  }
  return { valid: true };
}

export function getRelatedAlerts(
  blockId: string,
  step: FormStep | null | undefined,
  formData: FormData
): FormBlock[] {
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

export function getBlockById(schema: FormSchema, blockId: string): FormBlock | undefined {
  for (const step of schema.steps) {
    const block = step.blocks.find((b) => b.id === blockId);
    if (block) return block;
  }
  return undefined;
}

/** Format block value for display (summary, read-only views). Uses block options or defaults for property_type/urgency. */
export function getDisplayValue(block: FormBlock, value: unknown): string {
  if (value == null || (typeof value === "string" && value === "")) return "-";
  if (Array.isArray(value) && value.length === 0) return "-";

  const options =
    block.type === "property_type"
      ? (block.options?.length ? block.options : DEFAULT_PROPERTY_TYPE_OPTIONS)
      : block.type === "urgency"
        ? (block.options?.length ? block.options : DEFAULT_URGENCY_OPTIONS)
        : (block.options ?? []);

  const optionByValue = (v: string) => options.find((o) => o.value === v);

  switch (block.type) {
    case "single_select":
    case "radio":
    case "property_type":
    case "urgency": {
      const v = String(value);
      const opt = optionByValue(v);
      if (opt) return [opt.emoji, opt.label].filter(Boolean).join(" ");
      return v;
    }
    case "multi_select":
    case "checkbox": {
      const arr = Array.isArray(value) ? value : [value];
      return arr
        .map((v) => {
          const opt = optionByValue(String(v));
          return opt ? [opt.emoji, opt.label].filter(Boolean).join(" ") : String(v);
        })
        .join(", ");
    }
    case "yes_no":
      return value === true ? "Sim" : value === false ? "Não" : "-";
    case "number":
    case "slider": {
      const num = typeof value === "number" ? value : Number(value);
      const unit = block.unit ?? "";
      return unit ? `${num} ${unit}`.trim() : String(num);
    }
    case "date":
      try {
        const str = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          return new Date(str + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        }
      } catch {
        // ignore
      }
      return String(value);
    case "time":
      return String(value);
    case "image_gallery":
      if (Array.isArray(value)) return `${value.length} imagem(ns)`;
      return String(value);
    case "text":
    case "textarea":
    case "description_ai":
    default:
      return String(value);
  }
}
