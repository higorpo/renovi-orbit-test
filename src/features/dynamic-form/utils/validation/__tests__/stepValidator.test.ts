import { describe, it, expect } from "vitest";
import { validateSteps } from "../stepValidator";
import type { FormStep } from "../../../types";

describe("validateSteps", () => {
  it("reports error when step has no id", () => {
    const steps: FormStep[] = [
      { id: "", order: 0, title: "S1", blocks: [{ id: "b1", type: "text", label: "X" }] },
    ];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "STEP_MISSING_ID")).toBe(true);
  });

  it("reports error for duplicate step id", () => {
    const steps: FormStep[] = [
      { id: "same", order: 0, title: "S1", blocks: [{ id: "b1", type: "text", label: "X" }] },
      { id: "same", order: 1, title: "S2", blocks: [{ id: "b2", type: "text", label: "Y" }] },
    ];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "DUPLICATE_STEP_ID")).toBe(true);
  });

  it("reports error when step has no numeric order", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: undefined as unknown as number,
        title: "S1",
        blocks: [{ id: "b1", type: "text", label: "X" }],
      },
    ];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "STEP_MISSING_ORDER")).toBe(true);
  });

  it("reports error when step has no title", () => {
    const steps: FormStep[] = [
      { id: "s1", order: 0, title: "", blocks: [{ id: "b1", type: "text", label: "X" }] },
    ];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "STEP_MISSING_TITLE")).toBe(true);
  });

  it("reports error when step has no blocks", () => {
    const steps: FormStep[] = [{ id: "s1", order: 0, title: "S1", blocks: [] }];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "STEP_NO_BLOCKS")).toBe(true);
  });

  it("returns no errors for valid steps", () => {
    const steps: FormStep[] = [
      { id: "s1", order: 0, title: "Step 1", blocks: [{ id: "b1", type: "text", label: "Field" }] },
    ];
    const result = validateSteps(steps);
    expect(result.errors).toHaveLength(0);
  });

  it("delegates block validation and collects block errors", () => {
    const steps: FormStep[] = [
      {
        id: "s1",
        order: 0,
        title: "S1",
        blocks: [
          { id: "b1", type: "single_select", label: "X" }, // missing options
        ],
      },
    ];
    const result = validateSteps(steps);
    expect(result.errors.some((e) => e.code === "SELECT_NO_OPTIONS")).toBe(true);
  });
});
