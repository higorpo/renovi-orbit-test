import type { FormStep } from "../types";
import type {
  SchemaValidationError,
  SchemaValidationResult,
  ValidationSeverity,
} from "./validation/types";
import { validateSteps } from "./validation/stepValidator";
import { validateGlobalBlocks } from "./validation/globalRulesValidator";
import { validateGlobalOrder } from "./validation/globalRulesValidator";

export type { ValidationSeverity, SchemaValidationError, SchemaValidationResult };

export function validateFormSchema(schema: unknown): SchemaValidationResult {
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
  }

  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    errors.push({
      code: "NO_STEPS",
      message: "Schema must have at least one step",
      severity: "error",
    });
    return { valid: false, errors, warnings };
  }

  const steps = s.steps as FormStep[];
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
