import { describe, it, expect } from "vitest";
import { validateGlobalBlocks, validateGlobalOrder } from "../globalRulesValidator";
import type { FormStep } from "../../../types";

describe("validateGlobalBlocks", () => {
  it("reports error when schema has no property_type block", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "Low" }] },
          { id: "desc", type: "textarea", label: "D", description_ai: "D" },
        ],
      },
    ];
    const result = validateGlobalBlocks(steps);
    expect(result.errors.some((e) => e.code === "MISSING_PROPERTY_TYPE")).toBe(true);
  });

  it("reports error when schema has no urgency block", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] },
          { id: "desc", type: "textarea", label: "D", description_ai: "D" },
        ],
      },
    ];
    const result = validateGlobalBlocks(steps);
    expect(result.errors.some((e) => e.code === "MISSING_URGENCY")).toBe(true);
  });

  it("reports warning when no description_ai or textarea", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] },
          { id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "Low" }] },
        ],
      },
    ];
    const result = validateGlobalBlocks(steps);
    expect(result.warnings.some((e) => e.code === "MISSING_DESCRIPTION")).toBe(true);
  });

  it("returns no errors when property_type, urgency and description exist", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] },
          { id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "Low" }] },
          { id: "desc", type: "textarea", label: "D", description_ai: "D" },
        ],
      },
    ];
    const result = validateGlobalBlocks(steps);
    expect(result.errors).toHaveLength(0);
  });
});

describe("validateGlobalOrder", () => {
  it("reports error when first step does not contain property_type", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [{ id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "L" }] }],
      },
      {
        id: "s2",
        order: 1,
        title: "S2",
        blocks: [{ id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] }],
      },
    ];
    const result = validateGlobalOrder(steps);
    expect(result.errors.some((e) => e.code === "PROPERTY_TYPE_NOT_FIRST")).toBe(true);
  });

  it("reports error when urgency comes before property_type", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [{ id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "L" }] }],
      },
      {
        id: "s2",
        order: 1,
        title: "S2",
        blocks: [{ id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] }],
      },
    ];
    const result = validateGlobalOrder(steps);
    expect(result.errors.some((e) => e.code === "URGENCY_BEFORE_PROPERTY")).toBe(true);
  });

  it("reports warning when description comes before urgency", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] },
          { id: "desc", type: "description_ai", label: "D", description_ai: "D" },
        ],
      },
      {
        id: "s2",
        order: 1,
        title: "S2",
        blocks: [{ id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "L" }] }],
      },
    ];
    const result = validateGlobalOrder(steps);
    expect(result.warnings.some((e) => e.code === "DESCRIPTION_ORDER")).toBe(true);
  });

  it("returns no errors when order is correct", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "pt", type: "property_type", label: "T", description_ai: "T", options: [{ value: "a", label: "A" }] },
          { id: "urgency", type: "urgency", label: "U", description_ai: "U", options: [{ value: "low", label: "L" }] },
          { id: "desc", type: "textarea", label: "D", description_ai: "D" },
        ],
      },
    ];
    const result = validateGlobalOrder(steps);
    expect(result.errors).toHaveLength(0);
  });
});
