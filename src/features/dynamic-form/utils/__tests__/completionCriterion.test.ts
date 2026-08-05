import { describe, expect, it } from "vitest";
import type { FormBlock } from "../../types";
import {
  validateCompletionCriterionValue,
  getCompletionCriterionConfig,
} from "../completionCriterion";
import { validateCompletionChecklistSchema } from "../completionChecklist";

const baseBlock: FormBlock = {
  id: "c1",
  type: "completion_criterion",
  label: "Critério",
  required: true,
  description_ai: "c",
  config: {
    requires_evidence_when_met: false,
    evidence_min: 1,
    evidence_max: 2,
  },
};

describe("validateCompletionCriterionValue", () => {
  it("requires an answer when required", () => {
    expect(validateCompletionCriterionValue(baseBlock, undefined).valid).toBe(false);
  });

  it("accepts met=true without evidence when not required", () => {
    expect(
      validateCompletionCriterionValue(baseBlock, {
        met: true,
        evidence_paths: [],
      }).valid,
    ).toBe(true);
  });

  it("requires justification + evidence when unmet", () => {
    expect(
      validateCompletionCriterionValue(baseBlock, {
        met: false,
        evidence_paths: [],
      }).error,
    ).toMatch(/justificativa/i);

    expect(
      validateCompletionCriterionValue(baseBlock, {
        met: false,
        justification: "motivo",
        evidence_paths: [],
      }).error,
    ).toMatch(/foto/i);

    expect(
      validateCompletionCriterionValue(baseBlock, {
        met: false,
        justification: "motivo",
        evidence_paths: ["a.jpg"],
      }).valid,
    ).toBe(true);
  });

  it("requires evidence when requires_evidence_when_met", () => {
    const block: FormBlock = {
      ...baseBlock,
      config: { requires_evidence_when_met: true, evidence_min: 1, evidence_max: 5 },
    };
    expect(
      validateCompletionCriterionValue(block, {
        met: true,
        evidence_paths: [],
      }).valid,
    ).toBe(false);
    expect(
      validateCompletionCriterionValue(block, {
        met: true,
        evidence_paths: ["a.jpg"],
      }).valid,
    ).toBe(true);
  });
});

describe("getCompletionCriterionConfig", () => {
  it("applies defaults", () => {
    expect(
      getCompletionCriterionConfig({
        ...baseBlock,
        config: { requires_evidence_when_met: true },
      }),
    ).toEqual({
      requires_evidence_when_met: true,
      evidence_min: 1,
      evidence_max: 5,
    });
  });
});

describe("validateCompletionChecklistSchema", () => {
  it("rejects intake yes_no in completion schemas", () => {
    const result = validateCompletionChecklistSchema({
      steps: [
        {
          id: "s1",
          order: 0,
          title: "t",
          blocks: [
            {
              id: "bad",
              type: "yes_no",
              label: "x",
              description_ai: "x",
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("yes_no"))).toBe(true);
  });

  it("accepts allowlisted criteria within cardinality", () => {
    const criteria = Array.from({ length: 3 }, (_, i) => ({
      id: `c${i}`,
      type: "completion_criterion" as const,
      label: `Critério ${i}`,
      description_ai: "c",
      required: true,
      config: { requires_evidence_when_met: false },
    }));
    const result = validateCompletionChecklistSchema({
      steps: [
        {
          id: "s1",
          order: 0,
          title: "Checklist",
          blocks: [
            ...criteria,
            {
              id: "note",
              type: "static_text",
              label: "Nota",
              description_ai: "n",
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.criterionCount).toBe(3);
  });
});
