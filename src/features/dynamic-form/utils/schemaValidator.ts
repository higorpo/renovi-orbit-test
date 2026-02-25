import type { FormStepV2, FormBlockV2 } from "../types";

export type ValidationSeverity = "error" | "warning";

export interface SchemaValidationError {
  code: string;
  message: string;
  path?: string;
  severity: ValidationSeverity;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
}

const VALID_BLOCK_TYPES = [
  "property_type",
  "urgency",
  "description_ai",
  "single_select",
  "multi_select",
  "radio",
  "checkbox",
  "yes_no",
  "text",
  "textarea",
  "number",
  "slider",
  "date",
  "time",
  "conditional_alert",
  "static_text",
  "image_gallery",
  "preview_summary",
] as const;

export function validateFormSchemaV2(schema: unknown): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];

  if (!schema || typeof schema !== "object") {
    return {
      valid: false,
      errors: [
        { code: "INVALID_SCHEMA", message: "Schema is null or not an object", severity: "error" },
      ],
      warnings: [],
    };
  }

  const s = schema as Record<string, unknown>;

  if (s.version !== "2.0") {
    errors.push({
      code: "INVALID_VERSION",
      message: `Schema version must be "2.0", received: "${s.version}"`,
      severity: "error",
    });
  }

  if (!s.metadata || typeof s.metadata !== "object") {
    errors.push({
      code: "MISSING_METADATA",
      message: "Schema must have metadata",
      severity: "error",
    });
  } else {
    const metadata = s.metadata as Record<string, unknown>;
    if (!metadata.categorySlug || typeof metadata.categorySlug !== "string") {
      errors.push({
        code: "METADATA_MISSING_CATEGORY_SLUG",
        message: "metadata.categorySlug is required",
        path: "metadata.categorySlug",
        severity: "error",
      });
    }
    if (
      !metadata.status ||
      !["draft", "active", "deprecated"].includes(metadata.status as string)
    ) {
      errors.push({
        code: "METADATA_INVALID_STATUS",
        message: "metadata.status must be 'draft', 'active' or 'deprecated'",
        path: "metadata.status",
        severity: "error",
      });
    }
  }

  if (!s.config || typeof s.config !== "object") {
    errors.push({
      code: "MISSING_CONFIG",
      message: "Schema must have config",
      severity: "error",
    });
  } else {
    // Config validation for remaining schema-level options can be added here if needed
  }

  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    errors.push({
      code: "NO_STEPS",
      message: "Schema must have at least one step",
      severity: "error",
    });
    return { valid: false, errors, warnings };
  }

  const steps = s.steps as FormStepV2[];
  const stepResult = validateSteps(steps);
  errors.push(...stepResult.errors);
  warnings.push(...stepResult.warnings);
  const globalBlocks = validateGlobalBlocks(steps);
  errors.push(...globalBlocks.errors);
  warnings.push(...globalBlocks.warnings);
  const orderResult = validateGlobalOrder(steps);
  errors.push(...orderResult.errors);
  warnings.push(...orderResult.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSteps(steps: FormStepV2[]): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
} {
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

function validateBlocks(
  blocks: FormBlockV2[],
  stepId: string,
  parentPath: string
): { errors: SchemaValidationError[]; warnings: SchemaValidationError[] } {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const blockIds = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const path = `${parentPath}.blocks[${i}]`;

    if (!block.id) {
      errors.push({
        code: "BLOCK_MISSING_ID",
        message: `Block ${i} in step "${stepId}" has no ID`,
        path,
        severity: "error",
      });
    } else if (blockIds.has(block.id)) {
      errors.push({
        code: "DUPLICATE_BLOCK_ID",
        message: `Duplicate block ID: "${block.id}" in step "${stepId}"`,
        path,
        severity: "error",
      });
    } else {
      blockIds.add(block.id);
    }

    if (!block.type) {
      errors.push({
        code: "BLOCK_MISSING_TYPE",
        message: `Block "${block.id}" has no type`,
        path,
        severity: "error",
      });
    } else if (!VALID_BLOCK_TYPES.includes(block.type as (typeof VALID_BLOCK_TYPES)[number])) {
      errors.push({
        code: "INVALID_BLOCK_TYPE",
        message: `Block "${block.id}" has invalid type: "${block.type}"`,
        path,
        severity: "error",
      });
    }

    if (block.type !== "conditional_alert" && !block.label) {
      warnings.push({
        code: "BLOCK_MISSING_LABEL",
        message: `Block "${block.id}" has no label`,
        path,
        severity: "warning",
      });
    }

    if (["single_select", "multi_select", "radio", "checkbox"].includes(block.type)) {
      if (!Array.isArray(block.options) || block.options.length === 0) {
        errors.push({
          code: "SELECT_NO_OPTIONS",
          message: `Block "${block.id}" of type ${block.type} has no options`,
          path,
          severity: "error",
        });
      } else {
        for (let j = 0; j < block.options.length; j++) {
          const opt = block.options[j];
          if (!opt.value || !opt.label) {
            errors.push({
              code: "OPTION_INVALID",
              message: `Option ${j} in block "${block.id}" has no value or label`,
              path: `${path}.options[${j}]`,
              severity: "error",
            });
          }
        }
      }
    }

    if (["number", "slider"].includes(block.type)) {
      if (
        block.min !== undefined &&
        block.max !== undefined &&
        block.min > block.max
      ) {
        errors.push({
          code: "INVALID_RANGE",
          message: `Block "${block.id}" has min (${block.min}) greater than max (${block.max})`,
          path,
          severity: "error",
        });
      }
    }

    const validationErrors = validateBlockValidation(block, path);
    errors.push(...validationErrors);
  }

  return { errors, warnings };
}

/** Validation attributes allowed per block type. dateMin/dateMax only for "date"; timeMin/timeMax only for "time". */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function validateBlockValidation(
  block: FormBlockV2,
  parentPath: string
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const path = parentPath;
  const validation = block.validation;
  if (!validation || typeof validation !== "object") return errors;

  const v = validation as Record<string, unknown>;

  if (block.type === "date") {
    if (v.timeMin !== undefined || v.timeMax !== undefined) {
      errors.push({
        code: "DATE_BLOCK_INVALID_VALIDATION",
        message: `Block "${block.id}" has type "date"; timeMin/timeMax are only allowed for type "time"`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
    if (v.dateMin !== undefined) {
      if (typeof v.dateMin !== "string" || !DATE_REGEX.test(v.dateMin)) {
        errors.push({
          code: "INVALID_DATE_MIN",
          message: `Block "${block.id}": dateMin must be YYYY-MM-DD`,
          path: `${path}.validation.dateMin`,
          severity: "error",
        });
      }
    }
    if (v.dateMax !== undefined) {
      if (typeof v.dateMax !== "string" || !DATE_REGEX.test(v.dateMax)) {
        errors.push({
          code: "INVALID_DATE_MAX",
          message: `Block "${block.id}": dateMax must be YYYY-MM-DD`,
          path: `${path}.validation.dateMax`,
          severity: "error",
        });
      }
    }
    if (
      v.dateMin !== undefined &&
      v.dateMax !== undefined &&
      typeof v.dateMin === "string" &&
      typeof v.dateMax === "string" &&
      v.dateMin > v.dateMax
    ) {
      errors.push({
        code: "INVALID_DATE_RANGE",
        message: `Block "${block.id}": dateMin must be before or equal to dateMax`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
  } else if (block.type === "time") {
    if (v.dateMin !== undefined || v.dateMax !== undefined) {
      errors.push({
        code: "TIME_BLOCK_INVALID_VALIDATION",
        message: `Block "${block.id}" has type "time"; dateMin/dateMax are only allowed for type "date"`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
    if (v.timeMin !== undefined) {
      if (typeof v.timeMin !== "string" || !TIME_REGEX.test(v.timeMin)) {
        errors.push({
          code: "INVALID_TIME_MIN",
          message: `Block "${block.id}": timeMin must be HH:mm (e.g. 14:00)`,
          path: `${path}.validation.timeMin`,
          severity: "error",
        });
      }
    }
    if (v.timeMax !== undefined) {
      if (typeof v.timeMax !== "string" || !TIME_REGEX.test(v.timeMax)) {
        errors.push({
          code: "INVALID_TIME_MAX",
          message: `Block "${block.id}": timeMax must be HH:mm (e.g. 19:00)`,
          path: `${path}.validation.timeMax`,
          severity: "error",
        });
      }
    }
    if (
      v.timeMin !== undefined &&
      v.timeMax !== undefined &&
      typeof v.timeMin === "string" &&
      typeof v.timeMax === "string" &&
      v.timeMin > v.timeMax
    ) {
      errors.push({
        code: "INVALID_TIME_RANGE",
        message: `Block "${block.id}": timeMin must be before or equal to timeMax`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
  } else {
    if (v.dateMin !== undefined || v.dateMax !== undefined) {
      errors.push({
        code: "VALIDATION_DATE_FORBIDDEN",
        message: `Block "${block.id}" has type "${block.type}"; dateMin/dateMax are only allowed for type "date"`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
    if (v.timeMin !== undefined || v.timeMax !== undefined) {
      errors.push({
        code: "VALIDATION_TIME_FORBIDDEN",
        message: `Block "${block.id}" has type "${block.type}"; timeMin/timeMax are only allowed for type "time"`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
  }

  if (["number", "slider"].includes(block.type) && validation) {
    const min = (validation as { min?: number }).min;
    const max = (validation as { max?: number }).max;
    if (
      min !== undefined &&
      max !== undefined &&
      typeof min === "number" &&
      typeof max === "number" &&
      min > max
    ) {
      errors.push({
        code: "VALIDATION_INVALID_NUMBER_RANGE",
        message: `Block "${block.id}": validation.min must be less than or equal to validation.max`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
  }

  if (
    ["text", "textarea"].includes(block.type) &&
    validation &&
    typeof validation === "object"
  ) {
    const val = validation as { minLength?: number; maxLength?: number };
    if (
      val.minLength !== undefined &&
      val.maxLength !== undefined &&
      typeof val.minLength === "number" &&
      typeof val.maxLength === "number" &&
      val.minLength > val.maxLength
    ) {
      errors.push({
        code: "VALIDATION_INVALID_LENGTH_RANGE",
        message: `Block "${block.id}": validation.minLength must be less than or equal to validation.maxLength`,
        path: `${path}.validation`,
        severity: "error",
      });
    }
  }

  return errors;
}

function validateGlobalBlocks(steps: FormStepV2[]): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
} {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const allBlockTypes = new Set<string>();
  for (const step of steps) {
    for (const block of step.blocks) allBlockTypes.add(block.type);
  }
  if (!allBlockTypes.has("property_type")) {
    errors.push({
      code: "MISSING_PROPERTY_TYPE",
      message: 'Schema must have a block of type "property_type"',
      severity: "error",
    });
  }
  if (!allBlockTypes.has("urgency")) {
    errors.push({
      code: "MISSING_URGENCY",
      message: 'Schema must have a block of type "urgency"',
      severity: "error",
    });
  }
  if (!allBlockTypes.has("description_ai") && !allBlockTypes.has("textarea")) {
    warnings.push({
      code: "MISSING_DESCRIPTION",
      message: 'Schema should have a "description_ai" or "textarea" block for description',
      severity: "warning",
    });
  }
  return { errors, warnings };
}

function validateGlobalOrder(steps: FormStepV2[]): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
} {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const firstStep = sortedSteps[0];
  if (firstStep && !firstStep.blocks.some((b) => b.type === "property_type")) {
    errors.push({
      code: "PROPERTY_TYPE_NOT_FIRST",
      message: 'First step must contain the "property_type" block',
      severity: "error",
    });
  }
  let propertyTypeOrder = -1;
  let urgencyOrder = -1;
  let descriptionOrder = -1;
  for (const step of sortedSteps) {
    for (const block of step.blocks) {
      if (block.type === "property_type") propertyTypeOrder = step.order;
      if (block.type === "urgency") urgencyOrder = step.order;
      if (block.type === "description_ai") descriptionOrder = step.order;
    }
  }
  if (
    propertyTypeOrder > -1 &&
    urgencyOrder > -1 &&
    urgencyOrder < propertyTypeOrder
  ) {
    errors.push({
      code: "URGENCY_BEFORE_PROPERTY",
      message: "Urgency block must come after property_type",
      severity: "error",
    });
  }
  if (
    descriptionOrder > -1 &&
    urgencyOrder > -1 &&
    descriptionOrder < urgencyOrder
  ) {
    warnings.push({
      code: "DESCRIPTION_ORDER",
      message: "Description block should generally come after urgency",
      severity: "warning",
    });
  }
  return { errors, warnings };
}

export function formatValidationErrors(result: SchemaValidationResult): string {
  const lines: string[] = [];
  if (result.errors.length > 0) {
    lines.push("Errors (blocking):");
    for (const e of result.errors) {
      lines.push(`  [${e.code}] ${e.message}${e.path ? ` (${e.path})` : ""}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of result.warnings) {
      lines.push(`  [${w.code}] ${w.message}${w.path ? ` (${w.path})` : ""}`);
    }
  }
  if (result.valid) lines.push("Schema is valid.");
  return lines.join("\n");
}

export function getValidationSummary(result: SchemaValidationResult): {
  isBlocked: boolean;
  errorCount: number;
  warningCount: number;
  message: string;
} {
  return {
    isBlocked: !result.valid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    message: result.valid
      ? "Schema valid"
      : `${result.errors.length} error(s) found`,
  };
}
