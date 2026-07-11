import { describe, it, expect } from "vitest";
import type { FormBlock, FormSchema, FormStep, StepBlock, VisibilityRule } from "../schema";
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
  isStepBlockComplete,
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

  it("returns false for in when value is not an array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "in", value: "not-array" as unknown as string[] };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(false);
  });

  it("returns false for notIn when field value is in array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIn", value: ["a", "b"] };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(false);
  });

  it("returns false for notIn when rule value is not an array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIn", value: "x" as unknown as string[] };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(false);
  });

  it("returns true for notIncludes when array does not contain value", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIncludes", value: "c" };
    expect(evaluateVisibilityRule(rule, { x: ["a", "b"] })).toBe(true);
  });

  it("returns false for notIncludes when array contains value", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIncludes", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: ["a", "b"] })).toBe(false);
  });

  it("returns false for notIncludes when field is not an array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "notIncludes", value: "a" };
    expect(evaluateVisibilityRule(rule, { x: "a" })).toBe(false);
  });

  it("returns false for greaterThan when field value is not a number", () => {
    const rule: VisibilityRule = { dependsOn: "n", operator: "greaterThan", value: 5 };
    expect(evaluateVisibilityRule(rule, { n: "10" })).toBe(false);
  });

  it("returns true for lessThan when field is below value", () => {
    const rule: VisibilityRule = { dependsOn: "n", operator: "lessThan", value: 5 };
    expect(evaluateVisibilityRule(rule, { n: 3 })).toBe(true);
  });

  it("returns true for isEmpty when value is an empty array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "isEmpty" };
    expect(evaluateVisibilityRule(rule, { x: [] })).toBe(true);
  });

  it("returns false for isNotEmpty when value is empty string or empty array", () => {
    const rule: VisibilityRule = { dependsOn: "x", operator: "isNotEmpty" };
    expect(evaluateVisibilityRule(rule, { x: "" })).toBe(false);
    expect(evaluateVisibilityRule(rule, { x: [] })).toBe(false);
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

  it("uses custom validation.message when required value is empty", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "Name",
      required: true,
      description_ai: "Name",
      validation: { message: "Campo obrigatório custom" },
    };
    expect(validateBlockValue(block, "")).toEqual({
      valid: false,
      error: "Campo obrigatório custom",
    });
  });

  it("returns invalid when required multi_select has empty array", () => {
    const block: FormBlock = {
      id: "b1",
      type: "multi_select",
      label: "Opts",
      required: true,
      description_ai: "Opts",
      options: [{ value: "a", label: "A" }],
    };
    expect(validateBlockValue(block, [])).toEqual({
      valid: false,
      error: expect.any(String),
    });
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

  it("returns invalid when string length exceeds maxLength", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { maxLength: 3 },
    };
    expect(validateBlockValue(block, "abcd")).toEqual({
      valid: false,
      error: "Máximo de 3 caracteres",
    });
  });

  it("uses validation.min and validation.max for numbers when set", () => {
    const block: FormBlock = {
      id: "b1",
      type: "number",
      label: "N",
      description_ai: "N",
      validation: { min: 2, max: 4 },
    };
    expect(validateBlockValue(block, 1)).toEqual({
      valid: false,
      error: "Valor mínimo: 2",
    });
    expect(validateBlockValue(block, 5)).toEqual({
      valid: false,
      error: "Valor máximo: 4",
    });
    expect(validateBlockValue(block, 3)).toEqual({ valid: true });
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

  it("returns invalid when pattern is not a valid RegExp", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { pattern: "(", message: "Regex inválido" },
    };
    expect(validateBlockValue(block, "x")).toEqual({
      valid: false,
      error: "Regex inválido",
    });
  });

  it("returns invalid when pattern string exceeds max length without testing", () => {
    const longPattern = "a".repeat(501);
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { pattern: longPattern, message: "Formato longo" },
    };
    expect(validateBlockValue(block, "any")).toEqual({
      valid: false,
      error: "Formato longo",
    });
  });

  it("validates date min and max on date block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      description_ai: "D",
      validation: { dateMin: "2025-01-10", dateMax: "2025-01-20", message: "Data fora" },
    };
    expect(validateBlockValue(block, "2025-01-05")).toEqual({
      valid: false,
      error: "Data fora",
    });
    expect(validateBlockValue(block, "2025-01-25")).toEqual({
      valid: false,
      error: "Data fora",
    });
    expect(validateBlockValue(block, "2025-01-15")).toEqual({ valid: true });
  });

  it("uses default date min/max messages when validation.message is omitted", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      description_ai: "D",
      validation: { dateMin: "2025-01-10", dateMax: "2025-01-20" },
    };
    expect(validateBlockValue(block, "2025-01-05")).toEqual({
      valid: false,
      error: "Data mínima: 2025-01-10",
    });
    expect(validateBlockValue(block, "2025-01-25")).toEqual({
      valid: false,
      error: "Data máxima: 2025-01-20",
    });
  });

  it("validates time min and max on time block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      description_ai: "T",
      validation: { timeMin: "10:00", timeMax: "12:00", message: "Hora fora" },
    };
    expect(validateBlockValue(block, "09:00")).toEqual({
      valid: false,
      error: "Hora fora",
    });
    expect(validateBlockValue(block, "13:00")).toEqual({
      valid: false,
      error: "Hora fora",
    });
    expect(validateBlockValue(block, "11:00")).toEqual({ valid: true });
  });

  it("uses default time min/max messages when validation.message is omitted", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      description_ai: "T",
      validation: { timeMin: "10:00", timeMax: "12:00" },
    };
    expect(validateBlockValue(block, "09:00")).toEqual({
      valid: false,
      error: "Horário mínimo: 10:00",
    });
    expect(validateBlockValue(block, "13:00")).toEqual({
      valid: false,
      error: "Horário máximo: 12:00",
    });
  });

  it("uses default Formato inválido when pattern fails without message", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { pattern: "^[0-9]+$" },
    };
    expect(validateBlockValue(block, "abc")).toEqual({
      valid: false,
      error: "Formato inválido",
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

  it("returns partial progress when only some blocks are complete", () => {
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
          blocks: [
            { id: "b1", type: "text", label: "A", required: true, description_ai: "A" },
            { id: "b2", type: "text", label: "B", required: true, description_ai: "B" },
            { id: "b3", type: "text", label: "C", required: true, description_ai: "C" },
          ],
        },
      ],
    };
    expect(getFormProgress(schema, { b1: "filled" })).toBe(33);
  });
});

describe("isStepBlockComplete", () => {
  it("delegates to isBlockComplete for the wrapped block", () => {
    const stepBlock: StepBlock = {
      index: 0,
      stepId: "s1",
      stepTitle: "Step",
      blockId: "b1",
      block: { id: "b1", type: "text", label: "X", required: true, description_ai: "X" },
      progress: { current: 1, total: 1 },
    };
    expect(isStepBlockComplete(stepBlock, { b1: "ok" })).toBe(true);
    expect(isStepBlockComplete(stepBlock, {})).toBe(false);
  });
});

describe("getRelatedAlerts", () => {
  it("returns empty when step is null", () => {
    expect(getRelatedAlerts("b1", null, {})).toEqual([]);
  });

  it("returns empty when formData is not an object", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [
        {
          id: "alert1",
          type: "conditional_alert",
          label: "A",
          description_ai: "A",
          visibility: [{ dependsOn: "b1", operator: "equals", value: true }],
        },
      ],
    };
    expect(getRelatedAlerts("b1", step, "not-an-object" as unknown as Record<string, unknown>)).toEqual([]);
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

  it("skips alerts when visibility evaluation throws", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [
        {
          id: "alert1",
          type: "conditional_alert",
          label: "",
          description_ai: "Alert",
          visibility: [{ dependsOn: "b1", operator: "equals", value: true }],
        },
      ],
    };
    const formData: Record<string, unknown> = {};
    Object.defineProperty(formData, "b1", {
      get() {
        throw new Error("visibility boom");
      },
      enumerable: true,
    });
    expect(getRelatedAlerts("b1", step, formData)).toEqual([]);
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

  it("returns raw value for single_select when option is missing", () => {
    const block: FormBlock = {
      id: "b1",
      type: "single_select",
      label: "X",
      description_ai: "X",
      options: [{ value: "a", label: "A" }],
    };
    expect(getDisplayValue(block, "z")).toBe("z");
  });

  it("returns '-' for yes_no when value is not boolean", () => {
    const block: FormBlock = { id: "b1", type: "yes_no", label: "X", description_ai: "X" };
    expect(getDisplayValue(block, "maybe")).toBe("-");
  });

  it("returns slider value with optional unit", () => {
    const block: FormBlock = { id: "b1", type: "slider", label: "S", description_ai: "S", unit: "px" };
    expect(getDisplayValue(block, 42)).toBe("42 px");
  });

  it("returns image count for image_gallery array and string for scalar", () => {
    const block: FormBlock = { id: "b1", type: "image_gallery", label: "G", description_ai: "G" };
    expect(getDisplayValue(block, ["a", "b"])).toBe("2 imagem(ns)");
    expect(getDisplayValue(block, "one")).toBe("one");
  });

  it("maps checkbox value from non-array to single label", () => {
    const block: FormBlock = {
      id: "b1",
      type: "checkbox",
      label: "X",
      description_ai: "X",
      options: [{ value: "c1", label: "C1" }],
    };
    expect(getDisplayValue(block, "c1")).toBe("C1");
  });

  it("uses default property_type options when block has no options", () => {
    const block: FormBlock = {
      id: "b1",
      type: "property_type",
      label: "P",
      description_ai: "P",
      options: [],
    };
    const display = getDisplayValue(block, "house");
    expect(display.length).toBeGreaterThan(0);
    expect(display).not.toBe("house");
  });

  it("uses default urgency options when block has no options", () => {
    const block: FormBlock = {
      id: "b1",
      type: "urgency",
      label: "U",
      description_ai: "U",
      options: [],
    };
    const display = getDisplayValue(block, "low");
    expect(display.length).toBeGreaterThan(0);
    expect(display).not.toBe("low");
  });

  it("returns option label for radio when option exists", () => {
    const block: FormBlock = {
      id: "b1",
      type: "radio",
      label: "R",
      description_ai: "R",
      options: [{ value: "x", label: "Option X" }],
    };
    expect(getDisplayValue(block, "x")).toBe("Option X");
  });

  it("returns raw date string when value is not ISO YYYY-MM-DD", () => {
    const block: FormBlock = { id: "b1", type: "date", label: "D", description_ai: "D" };
    expect(getDisplayValue(block, "26/02/2025")).toBe("26/02/2025");
  });

  it("returns time value as string", () => {
    const block: FormBlock = { id: "b1", type: "time", label: "T", description_ai: "T" };
    expect(getDisplayValue(block, "14:30")).toBe("14:30");
  });

  it("returns number without unit when unit is unset", () => {
    const block: FormBlock = { id: "b1", type: "number", label: "N", description_ai: "N" };
    expect(getDisplayValue(block, 7)).toBe("7");
  });

  it("formats slider string values without unit", () => {
    const block: FormBlock = { id: "b1", type: "slider", label: "S", description_ai: "S" };
    expect(getDisplayValue(block, "3")).toBe("3");
  });

  it("formats checkbox options with emoji and falls back for unknown values", () => {
    const block: FormBlock = {
      id: "b1",
      type: "checkbox",
      label: "C",
      description_ai: "C",
      options: [{ value: "a", label: "Alpha", emoji: "🅰️" }],
    };
    expect(getDisplayValue(block, ["a", "z"])).toBe("🅰️ Alpha, z");
  });

  it("returns string value for description_ai block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "description_ai",
      label: "Desc",
      description_ai: "Desc",
    };
    expect(getDisplayValue(block, "texto gerado")).toBe("texto gerado");
  });

  it.each([
    { value: undefined, expected: "-" },
    { value: [], expected: "-" },
  ])("returns '-' for empty-like value $value", ({ value, expected }) => {
    const block: FormBlock = { id: "b1", type: "text", label: "X", description_ai: "X" };
    expect(getDisplayValue(block, value)).toBe(expected);
  });

  it("uses custom property_type and urgency options when provided", () => {
    const property: FormBlock = {
      id: "p",
      type: "property_type",
      label: "P",
      description_ai: "P",
      options: [{ value: "loft", label: "Loft", emoji: "🏠" }],
    };
    const urgency: FormBlock = {
      id: "u",
      type: "urgency",
      label: "U",
      description_ai: "U",
      options: [{ value: "asap", label: "Já", emoji: "⚡" }],
    };
    expect(getDisplayValue(property, "loft")).toBe("🏠 Loft");
    expect(getDisplayValue(urgency, "asap")).toBe("⚡ Já");
  });

  it("returns label-only when option has no emoji", () => {
    const block: FormBlock = {
      id: "b1",
      type: "single_select",
      label: "X",
      description_ai: "X",
      options: [{ value: "a", label: "Only label" }],
    };
    expect(getDisplayValue(block, "a")).toBe("Only label");
  });

  it("returns textarea and text values as strings", () => {
    const textarea: FormBlock = { id: "t", type: "textarea", label: "T", description_ai: "T" };
    const text: FormBlock = { id: "x", type: "text", label: "X", description_ai: "X" };
    expect(getDisplayValue(textarea, "long")).toBe("long");
    expect(getDisplayValue(text, 42)).toBe("42");
  });
});

describe("evaluateVisibilityRule remaining branches", () => {
  it.each([
    {
      name: "includes when value missing from array",
      rule: { dependsOn: "x", operator: "includes" as const, value: "z" },
      data: { x: ["a", "b"] },
      expected: false,
    },
    {
      name: "greaterThan when rule value is not a number",
      rule: { dependsOn: "n", operator: "greaterThan" as const, value: "5" as unknown as number },
      data: { n: 10 },
      expected: false,
    },
    {
      name: "lessThan when rule value is not a number",
      rule: { dependsOn: "n", operator: "lessThan" as const, value: "5" as unknown as number },
      data: { n: 1 },
      expected: false,
    },
    {
      name: "isEmpty for null",
      rule: { dependsOn: "x", operator: "isEmpty" as const },
      data: { x: null },
      expected: true,
    },
    {
      name: "isEmpty for non-empty array",
      rule: { dependsOn: "x", operator: "isEmpty" as const },
      data: { x: ["a"] },
      expected: false,
    },
    {
      name: "isNotEmpty for non-empty array",
      rule: { dependsOn: "x", operator: "isNotEmpty" as const },
      data: { x: ["a"] },
      expected: true,
    },
    {
      name: "isNotEmpty for null",
      rule: { dependsOn: "x", operator: "isNotEmpty" as const },
      data: { x: null },
      expected: false,
    },
  ])("$name", ({ rule, data, expected }) => {
    expect(evaluateVisibilityRule(rule, data)).toBe(expected);
  });
});

describe("visibility empty arrays and step visibility pass", () => {
  it("treats empty visibility arrays as always visible", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "X",
      description_ai: "X",
      visibility: [],
    };
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [],
      visibility: [],
    };
    expect(isBlockVisible(block, {})).toBe(true);
    expect(isStepVisible(step, {})).toBe(true);
  });

  it("returns true when step visibility rules all pass", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S1",
      blocks: [],
      visibility: [{ dependsOn: "role", operator: "equals", value: "admin" }],
    };
    expect(isStepVisible(step, { role: "admin" })).toBe(true);
  });
});

describe("buildStepBlocks and isStepComplete with conditional_alert", () => {
  it("excludes conditional_alert from progress and treats it as complete", () => {
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
          title: "Step",
          icon: "home",
          description: "desc",
          blocks: [
            { id: "b1", type: "text", label: "A", required: true, description_ai: "A" },
            {
              id: "alert",
              type: "conditional_alert",
              label: "",
              description_ai: "Alert",
              visibility: [{ dependsOn: "b1", operator: "isNotEmpty" }],
            },
          ],
        },
      ],
    };
    const stepBlocks = buildStepBlocks(schema, { b1: "x" });
    expect(stepBlocks).toHaveLength(1);
    expect(stepBlocks[0]).toMatchObject({
      stepIcon: "home",
      stepDescription: "desc",
      progress: { current: 1, total: 1 },
    });
    expect(isStepComplete(schema.steps[0]!, { b1: "x" })).toBe(true);
  });
});

describe("validateBlockValue remaining branches", () => {
  it("returns invalid for null required value with default message", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "N",
      required: true,
      description_ai: "N",
    };
    expect(validateBlockValue(block, null)).toEqual({
      valid: false,
      error: "Campo obrigatório",
    });
  });

  it("uses block.min/max when validation object omits min/max", () => {
    const block: FormBlock = {
      id: "b1",
      type: "number",
      label: "N",
      description_ai: "N",
      min: 3,
      max: 7,
      validation: {},
    };
    expect(validateBlockValue(block, 2)).toEqual({ valid: false, error: "Valor mínimo: 3" });
    expect(validateBlockValue(block, 8)).toEqual({ valid: false, error: "Valor máximo: 7" });
    expect(validateBlockValue(block, 5)).toEqual({ valid: true });
  });

  it("returns valid for number within block min/max without validation object", () => {
    const block: FormBlock = {
      id: "b1",
      type: "number",
      label: "N",
      description_ai: "N",
      min: 1,
      max: 10,
    };
    expect(validateBlockValue(block, 5)).toEqual({ valid: true });
  });

  it("returns valid for string that satisfies all string constraints", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { minLength: 2, maxLength: 10, pattern: "^[a-z]+$" },
    };
    expect(validateBlockValue(block, "abc")).toEqual({ valid: true });
  });

  it("uses default Formato inválido for oversized and invalid patterns without message", () => {
    const longPattern = "a".repeat(501);
    expect(
      validateBlockValue(
        {
          id: "b1",
          type: "text",
          label: "T",
          description_ai: "T",
          validation: { pattern: longPattern },
        },
        "x",
      ),
    ).toEqual({ valid: false, error: "Formato inválido" });
    expect(
      validateBlockValue(
        {
          id: "b1",
          type: "text",
          label: "T",
          description_ai: "T",
          validation: { pattern: "(" },
        },
        "x",
      ),
    ).toEqual({ valid: false, error: "Formato inválido" });
  });

  it("validates dateMin-only and dateMax-only independently", () => {
    expect(
      validateBlockValue(
        {
          id: "d",
          type: "date",
          label: "D",
          description_ai: "D",
          validation: { dateMin: "2025-06-01" },
        },
        "2025-05-01",
      ),
    ).toEqual({ valid: false, error: "Data mínima: 2025-06-01" });
    expect(
      validateBlockValue(
        {
          id: "d",
          type: "date",
          label: "D",
          description_ai: "D",
          validation: { dateMax: "2025-06-01" },
        },
        "2025-07-01",
      ),
    ).toEqual({ valid: false, error: "Data máxima: 2025-06-01" });
  });

  it("validates timeMin-only and timeMax-only independently", () => {
    expect(
      validateBlockValue(
        {
          id: "t",
          type: "time",
          label: "T",
          description_ai: "T",
          validation: { timeMin: "09:00" },
        },
        "08:00",
      ),
    ).toEqual({ valid: false, error: "Horário mínimo: 09:00" });
    expect(
      validateBlockValue(
        {
          id: "t",
          type: "time",
          label: "T",
          description_ai: "T",
          validation: { timeMax: "18:00" },
        },
        "19:00",
      ),
    ).toEqual({ valid: false, error: "Horário máximo: 18:00" });
  });

  it("ignores date/time bounds on non-date/time blocks", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: {
        dateMin: "2025-01-01",
        dateMax: "2025-01-02",
        timeMin: "10:00",
        timeMax: "11:00",
      },
    };
    expect(validateBlockValue(block, "anything")).toEqual({ valid: true });
  });

  it("returns valid for non-string non-number filled values", () => {
    const block: FormBlock = {
      id: "b1",
      type: "yes_no",
      label: "Y",
      description_ai: "Y",
      validation: { message: "x" },
    };
    expect(validateBlockValue(block, true)).toEqual({ valid: true });
  });
});

describe("getRelatedAlerts remaining branches", () => {
  it("returns empty for missing blockId, missing blocks, or non-array blocks", () => {
    const step: FormStep = { id: "s1", order: 0, title: "S", blocks: [] };
    expect(getRelatedAlerts("", step, {})).toEqual([]);
    expect(getRelatedAlerts("b1", { ...step, blocks: undefined as unknown as FormBlock[] }, {})).toEqual(
      [],
    );
    expect(
      getRelatedAlerts("b1", { ...step, blocks: "x" as unknown as FormBlock[] }, {}),
    ).toEqual([]);
  });

  it("skips non-alert blocks, alerts without visibility, and unrelated dependsOn", () => {
    const step: FormStep = {
      id: "s1",
      order: 0,
      title: "S",
      blocks: [
        null as unknown as FormBlock,
        { id: "text", type: "text", label: "T", description_ai: "T" },
        {
          id: "alert-empty",
          type: "conditional_alert",
          label: "",
          description_ai: "A",
          visibility: [],
        },
        {
          id: "alert-other",
          type: "conditional_alert",
          label: "",
          description_ai: "A",
          visibility: [{ dependsOn: "other", operator: "equals", value: true }],
        },
        {
          id: "alert-null-rule",
          type: "conditional_alert",
          label: "",
          description_ai: "A",
          visibility: [null as unknown as VisibilityRule],
        },
      ],
    };
    expect(getRelatedAlerts("b1", step, { b1: true })).toEqual([]);
  });

  it("returns empty when step is undefined", () => {
    expect(getRelatedAlerts("b1", undefined, {})).toEqual([]);
  });
});

describe("getBlockById across multiple steps", () => {
  it("finds a block in a later step", () => {
    const schema: FormSchema = {
      version: "2.0",
      id: "f1",
      title: "Form",
      metadata: { categorySlug: "cat", categoryId: null, status: "draft" },
      config: {},
      steps: [
        { id: "s1", order: 0, title: "S1", blocks: [{ id: "a", type: "text", label: "A", description_ai: "A" }] },
        { id: "s2", order: 1, title: "S2", blocks: [{ id: "b", type: "text", label: "B", description_ai: "B" }] },
      ],
    };
    expect(getBlockById(schema, "b")?.id).toBe("b");
  });
});
