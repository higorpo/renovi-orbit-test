import type { FormBlock, FormBlockType } from "../../types";
import { FORM_BLOCK_TYPES } from "../../types/schema";
import type { SchemaValidationError } from "./types";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export function validateBlocks(
  blocks: FormBlock[],
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
    } else if (!FORM_BLOCK_TYPES.includes(block.type as FormBlockType)) {
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

    const descAi =
      typeof block.description_ai === "string" ? block.description_ai.trim() : "";
    if (!descAi) {
      errors.push({
        code: "BLOCK_MISSING_DESCRIPTION_AI",
        message: `Block "${block.id}" must have a non-empty description_ai (what the data is and how the AI should interpret it)`,
        path,
        severity: "error",
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

    if (block.type === "completion_criterion") {
      const cfg = block.config as Record<string, unknown> | undefined;
      if (!cfg || typeof cfg.requires_evidence_when_met !== "boolean") {
        errors.push({
          code: "COMPLETION_CRITERION_CONFIG",
          message: `Block "${block.id}" must set config.requires_evidence_when_met (boolean)`,
          path: `${path}.config`,
          severity: "error",
        });
      }
      const evMin = cfg?.evidence_min;
      const evMax = cfg?.evidence_max;
      if (evMin !== undefined && (typeof evMin !== "number" || evMin < 1)) {
        errors.push({
          code: "COMPLETION_CRITERION_EVIDENCE_MIN",
          message: `Block "${block.id}" evidence_min must be an integer >= 1`,
          path: `${path}.config.evidence_min`,
          severity: "error",
        });
      }
      if (
        typeof evMin === "number" &&
        typeof evMax === "number" &&
        evMax < evMin
      ) {
        errors.push({
          code: "COMPLETION_CRITERION_EVIDENCE_RANGE",
          message: `Block "${block.id}" evidence_max must be >= evidence_min`,
          path: `${path}.config`,
          severity: "error",
        });
      }
    }

    const validationErrors = validateBlockValidation(block, path);
    errors.push(...validationErrors);
  }

  return { errors, warnings };
}

/** Validation attributes allowed per block type: dateMin/dateMax for "date", timeMin/timeMax for "time". */
export function validateBlockValidation(
  block: FormBlock,
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
