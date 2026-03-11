import { describe, it, expect } from "vitest";
import type { FormBlock, FormSchema, FormStep, VisibilityRule } from "../schema";
import {
  evaluateVisibilityRule,
  isBlockVisible,
  isStepVisible,
  getVisibleSteps,
  getVisibleBlocks,
  buildStepBlocks,
  isBlockComplete,
  isStepComplete,
  getFormProgress,
  validateBlockValue,
  getRelatedAlerts,
  getBlockById,
  getDisplayValue,
} from "../helpers";

describe("evaluateVisibilityRule", () => {
  it("returns true for equals when value matches", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "equals", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(true);
  });

  it("returns false for equals when value does not match", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "equals", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: "b" })).toBe(false);
  });

  it("returns true for notEquals when value differs", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notEquals", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: "b" })).toBe(true);
  });

  it("returns true for in when field value is in array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "in", value: ["a", "b"] };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(true);
  });

  it("returns false for in when field value is not in array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "in", value: ["a", "b"] };
    expect(evaluateVisibilityRule(rule, { x: "c" })).toBe(false);
  });

  it("returns true for notIn when field value is not in array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIn", value: ["a", "b"] };
    expect(evaluateVisibilityRule(rule, { x: "c" })).toBe(true);
  });

  it("returns true for includes when array field contains value", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "includes", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: ["a", "b"] })).toBe(true);
  });

  it("returns false for includes when field is not array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "includes", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(false);
  });

  it("returns true for greaterThan when field > value", () => {
    const rule: VisibilityRule = { dependsOn: "n", operator: "greaterThan", value: 5 };
    expect(evaluateVisibilityRule(rule, { n: 10 })).toBe(true);
  });

  it("returns false for lessThan when field >= value", () => {
    const rule: VisibilityRule = { dependsOn: "n", operator: "lessThan", value: 5 };
    expect(evaluateVisibilityRule(rule, { n: 5 })).toBe(false);
  });

  it("returns true for isEmpty when value is empty string", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "isEmpty" };
    expect(evaluateVisibilityRule(rule, { x: "" })).toBe(true);
  });

  it("returns true for isEmpty when value is undefined", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "isEmpty" };
    expect(evaluateVisibilityRule(rule, {})).toBe(true);
  });

  it("returns true for isNotEmpty when value is non-empty", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "isNotEmpty" };
    expect(evaluateVisibilityRule(rule, { x: "hello" })).toBe(true);
  });

  it("returns true for unknown operator (default)", () => {
    const rule = { dependsOn: "x", operator: "unknown" as VisibilityRule["operator"] };
    expect(evaluateVisibilityRule(rule, { x: "y" })).toBe(true);
  });
});

describe("isBlockVisible", () => {
  it("returns true when block has no visibility rules", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "X", description_ai: "X" };
    expect(isBlockVisible(block, {})).toBe(true);
  });

  it("returns true when all visibility rules pass", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "X",
      description_ai: "X",
      visibility: [{ dependsOn: "show", operator: "equals", value: true }],
    };
    expect(isBlockVisible(block, { show: true })).toBe(true);
  });

  it("returns false when one visibility rule fails", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "X",
      description_ai: "X",
      visibility: [{ dependsOn: "show", operator: "equals", value: true }],
    };
    expect(isBlockVisible(block, { show: false })).toBe(false);
  });
});

describe("isStepVisible", () => {
  it("returns true when step has no visibility", () => {
    const step: FormStep = { id: "s1", order: 0, title: "S1", blocks: [] };
    expect(isStepVisible(step, {})).toBe(true);
  });

  it("returns false when step visibility rule fails", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [],
      visibility: [{ dependsOn: "role", operator: "equals", value: "admin" }],
    };
    expect(isStepVisible(step, { role: "user" })).toBe(false);
  });
});

describe("getVisibleSteps", () => {
  it("filters and sorts steps by visibility and order", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        { id: "s2", order: 2, title: "Second", blocks: [] },
        { id: "s1", order: 1, title: "First", blocks: [] },
        {
          id: "s0",
          order: 0,
          title: "Hidden",
          blocks: [],
          visibility: [{ dependsOn: "show", operator: "equals", value: true }],
        },
      ],
    };
    const visible = getVisibleSteps(schema, { show: false });
    expect(visible).toHaveLength(2);
    expect(visible[0].id).toBe("s1");
    expect(visible[1].id).toBe("s2");
  });
});

describe("getVisibleBlocks", () => {
  it("filters blocks by visibility", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [
        { id: "b1", type: "text", label: "A", description_ai: "A" },
        {
          id: "b2",
          type: "text",
          label: "B",
          description_ai: "B",
          visibility: [{ dependsOn: "showB", operator: "equals", value: true }],
        },
      ],
    };
    const visible = getVisibleBlocks(step, { showB: false });
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("b1");
  });
});

describe("buildStepBlocks", () => {
  it("returns step blocks with progress excluding conditional_alert and static_text", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "Step 1",
          blocks: [
            { id: "b1", type: "text", label: "Field 1", description_ai: "Field 1" },
            { id: "b2", type: "static_text", label: "", description_ai: "Static" },
          ],
        },
      ],
    };
    const stepBlocks = buildStepBlocks(schema, {});
    expect(stepBlocks).toHaveLength(1);
    expect(stepBlocks[0].blockId).toBe("b1");
    expect(stepBlocks[0].progress).toEqual({ current: 1, total: 1 });
  });
});

describe("validateBlockValue", () => {
  it("returns valid for static_text always", () => {
    const block: FormBlock = { id: "b1", type: "static_text", label: "", description_ai: "Static" };
    expect(validateBlockValue(block, null)).toEqual({ valid: true });
  });

  it("returns invalid when required and value is empty", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "Name", required: true, description_ai: "Name" };
    expect(validateBlockValue(block, "")).toEqual({ valid: false, error: expect.any(String) });
  });

  it("returns valid when not required and value is empty", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "Name", required: false, description_ai: "Name" };
    expect(validateBlockValue(block, undefined)).toEqual({ valid: true });
  });

  it("returns invalid when number is below min", () => {
    const block: FormBlock = { id: "b1", type: "number", label: "N", min: 10, description_ai: "N" };
    expect(validateBlockValue(block, 5)).toEqual({ valid: false, error: "Valor mínimo: 10" });
  });

  it("returns invalid when number is above max", () => {
    const block: FormBlock = { id: "b1", type: "number", label: "N", max: 10, description_ai: "N" };
    expect(validateBlockValue(block, 15)).toEqual({ valid: false, error: "Valor máximo: 10" });
  });

  it("returns invalid when string length is below minLength", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { minLength: 5 },
    };
    expect(validateBlockValue(block, "ab")).toEqual({
      valid: false,
      error: "Mínimo de 5 caracteres",
    });
  });

  it("returns invalid when pattern does not match", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { pattern: "^[0-9]+$", message: "Apenas números" },
    };
    expect(validateBlockValue(block, "abc")).toEqual({
      valid: false,
      error: "Apenas números",
    });
  });
});

describe("isBlockComplete", () => {
  it("returns true when value is valid", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "X", required: true, description_ai: "X" };
    expect(isBlockComplete(block, { b1: "filled" })).toBe(true);
  });

  it("returns false when required and empty", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "X", required: true, description_ai: "X" };
    expect(isBlockComplete(block, {})).toBe(false);
  });
});

describe("isStepComplete", () => {
  it("returns true when all visible input blocks are complete", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [
        { id: "b1", type: "text", label: "A", required: true, description_ai: "A" },
        { id: "b2", type: "static_text", label: "", description_ai: "Static" },
      ],
    };
    expect(isStepComplete(step, { b1: "x" })).toBe(true);
  });

  it("returns false when one block is incomplete", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [{ id: "b1", type: "text", label: "A", required: true, description_ai: "A" }],
    };
    expect(isStepComplete(step, {})).toBe(false);
  });
});

describe("getFormProgress", () => {
  it("returns 0 when no step blocks", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S1",
          blocks: [{ id: "b1", type: "static_text", label: "", description_ai: "Static" }],
        },
      ],
    };
    expect(getFormProgress(schema, {})).toBe(0);
  });

  it("returns 100 when all blocks complete", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S1",
          blocks: [{ id: "b1", type: "text", label: "X", required: true, description_ai: "X" }],
        },
      ],
    };
    expect(getFormProgress(schema, { b1: "filled" })).toBe(100);
  });
});

describe("getRelatedAlerts", () => {
  it("returns empty when step is null", () => {
    expect(getRelatedAlerts("b1", null, {})).toEqual([]);
  });

  it("returns conditional_alert blocks that depend on blockId and are visible", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [
        { id: "b1", type: "yes_no", label: "Yes?", description_ai: "Yes/no" },
        {
          id: "alert1",
          type: "conditional_alert",
          label: "",
          description_ai: "Alert",
          visibility: [{ dependsOn: "b1", operator: "equals", value: true }],
        },
      ],
    };
    const alerts = getRelatedAlerts("b1", step, { b1: true });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("alert1");
  });
});

describe("getBlockById", () => {
  it("returns block when found", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        {
          id: "s1",
          order: 0,
          title: "S1",
          blocks: [{ id: "target", type: "text", label: "X", description_ai: "Target" }],
        },
      ],
    };
    expect(getBlockById(schema, "target")?.id).toBe("target");
  });

  it("returns undefined when block not found", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [{ id: "s1", order: 0, title: "S1", blocks: [] }],
    };
    expect(getBlockById(schema, "missing")).toBeUndefined();
  });
});

describe("getDisplayValue", () => {
  it("returns '-' for null or empty value", () => {
    const block: FormBlock = { id: "b1", type: "text", label: "X", description_ai: "X" };
    expect(getDisplayValue(block, null)).toBe("-");
    expect(getDisplayValue(block, "")).toBe("-");
  });

  it("returns option label for single_select when option exists", () => {
    const block: FormBlock = {
      id: "b1",
      type: "single_select",
      label: "X",
      description_ai: "X",
      options: [{ value: "a", label: "Option A", emoji: "🅰️" }],
    };
    expect(getDisplayValue(block, "a")).toBe("🅰️ Option A");
  });

  it("returns 'Sim'/'Não' for yes_no", () => {
    const block: FormBlock = { id: "b1", type: "yes_no", label: "X", description_ai: "X" };
    expect(getDisplayValue(block, true)).toBe("Sim");
    expect(getDisplayValue(block, false)).toBe("Não");
  });

  it("returns number with unit for number block", () => {
    const block: FormBlock = { id: "b1", type: "number", label: "N", unit: "m²", description_ai: "N" };
    expect(getDisplayValue(block, 10)).toBe("10 m²");
  });

  it("formats date as pt-BR when value is YYYY-MM-DD", () => {
    const block: FormBlock = { id: "b1", type: "date", label: "D", description_ai: "D" };
    expect(getDisplayValue(block, "2025-02-26")).toMatch(/\d{2}\/\d{2}\/2025/);
  });

  it("returns comma-separated labels for multi_select", () => {
    const block: FormBlock = {
      id: "b1",
      type: "multi_select",
      label: "X",
      description_ai: "X",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    };
    expect(getDisplayValue(block, ["a", "b"])).toBe("A, B");
  });
});
