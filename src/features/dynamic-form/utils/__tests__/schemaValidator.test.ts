import { describe, it, expect } from "vitest";
import {
  validateFormSchema,
  formatValidationErrors,
  getValidationSummary,
} from "../schemaValidator";
import type { FormStep } from "../../types";

describe("validateFormSchema", () => {
  const validSteps: FormStep[] = [
    {
      id: "s1",
      order: 0,
      title: "Step 1",
      blocks: [
        { id: "property_type", type: "property_type", label: "Tipo", description_ai: "Tipo", options: [{ value: "a", label: "A" }] },
        { id: "urgency", type: "urgency", label: "Urgência", description_ai: "Urgência", options: [{ value: "low", label: "Low" }] },
        { id: "desc", type: "textarea", label: "Descrição", description_ai: "Descrição" },
      ],
    },
  ];

  const validSchema = {
    version: "2.0",
    metadata: { categorySlug: "cat", status: "draft" },
    config: {},
    steps: validSteps,
  };

  it("returns invalid when schema is null", () => {
    const result = validateFormSchema(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "INVALID_SCHEMA", severity: "error" })
    );
  });

  it("returns invalid when schema is not an object", () => {
    const result = validateFormSchema(42);
    expect(result.valid).toBe(false);
  });

  it("returns invalid when version is not 2.0", () => {
    const result = validateFormSchema({ ...validSchema, version: "1.0" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_VERSION")).toBe(true);
  });

  it("returns invalid when metadata is missing", () => {
    const result = validateFormSchema({ version: "2.0", config: {}, steps: validSteps });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_METADATA")).toBe(true);
  });

  it("returns invalid when metadata.categorySlug is missing", () => {
    const result = validateFormSchema({
      version: "2.0",
      metadata: { status: "draft" },
      config: {},
      steps: validSteps,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "METADATA_MISSING_CATEGORY_SLUG")).toBe(true);
  });

  it("returns invalid when metadata.status is invalid", () => {
    const result = validateFormSchema({
      version: "2.0",
      metadata: { categorySlug: "cat", status: "invalid" },
      config: {},
      steps: validSteps,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "METADATA_INVALID_STATUS")).toBe(true);
  });

  it("returns invalid when config is missing", () => {
    const result = validateFormSchema({
      version: "2.0",
      metadata: { categorySlug: "cat", status: "draft" },
      steps: validSteps,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_CONFIG")).toBe(true);
  });

  it("returns invalid when steps is empty or not array", () => {
    const result = validateFormSchema({ ...validSchema, steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "NO_STEPS")).toBe(true);
  });

  it("returns valid for minimal valid schema with required blocks", () => {
    const result = validateFormSchema(validSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("formatValidationErrors", () => {
  it("formats errors and warnings with code and path", () => {
    const result = {
      valid: false,
      errors: [{ code: "ERR", message: "Error message", path: "steps[0]", severity: "error" as const }],
      warnings: [{ code: "WARN", message: "Warning", severity: "warning" as const }],
    };
    const formatted = formatValidationErrors(result);
    expect(formatted).toContain("Errors (blocking):");
    expect(formatted).toContain("[ERR] Error message (steps[0])");
    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain("[WARN] Warning");
  });

  it("includes 'Schema is valid.' when valid", () => {
    const result = { valid: true, errors: [], warnings: [] };
    expect(formatValidationErrors(result)).toContain("Schema is valid.");
  });
});

describe("getValidationSummary", () => {
  it("returns isBlocked true and error count when invalid", () => {
    const result = {
      valid: false,
      errors: [{ code: "E1", message: "M1", severity: "error" as const }],
      warnings: [],
    };
    const summary = getValidationSummary(result);
    expect(summary.isBlocked).toBe(true);
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(0);
    expect(summary.message).toContain("1 error");
  });

  it("returns isBlocked false and 'Schema valid' when valid", () => {
    const result = { valid: true, errors: [], warnings: [] };
    const summary = getValidationSummary(result);
    expect(summary.isBlocked).toBe(false);
    expect(summary.message).toBe("Schema valid");
  });
});
