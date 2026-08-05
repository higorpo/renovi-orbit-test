import { describe, expect, it } from "vitest";
import type { FormBlock } from "@/features/dynamic-form";
import { validateExecutedResponses } from "../validateExecutedResponses";

const criterion = (
  id: string,
  config: Record<string, unknown> = {},
): FormBlock => ({
  id,
  type: "completion_criterion",
  label: `Critério ${id}`,
  description_ai: id,
  required: true,
  config: {
    requires_evidence_when_met: false,
    evidence_min: 1,
    evidence_max: 5,
    ...config,
  },
});

describe("validateExecutedResponses", () => {
  it("requires all criteria answered", () => {
    const result = validateExecutedResponses(
      [criterion("a"), criterion("b")],
      { a: { met: true, evidence_paths: [] } },
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.blockId === "b")).toBe(true);
  });

  it("requires justification + evidence when unmet", () => {
    const result = validateExecutedResponses([criterion("a")], {
      a: { met: false, justification: "", evidence_paths: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.error).toMatch(/justificativa/i);
  });

  it("accepts unmet with justification and evidence", () => {
    const result = validateExecutedResponses([criterion("a")], {
      a: {
        met: false,
        justification: "Cliente pediu ajuste",
        evidence_paths: ["p/a.jpg"],
      },
    });
    expect(result.valid).toBe(true);
  });

  it("requires evidence when requires_evidence_when_met", () => {
    const result = validateExecutedResponses(
      [criterion("a", { requires_evidence_when_met: true })],
      { a: { met: true, evidence_paths: [] } },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.error).toMatch(/foto/i);
  });

  it("ignores static_text blocks", () => {
    const blocks: FormBlock[] = [
      {
        id: "s",
        type: "static_text",
        label: "Hint",
        description_ai: "hint",
      },
      criterion("a"),
    ];
    const result = validateExecutedResponses(blocks, {
      a: { met: true, evidence_paths: [] },
    });
    expect(result.valid).toBe(true);
  });
});
