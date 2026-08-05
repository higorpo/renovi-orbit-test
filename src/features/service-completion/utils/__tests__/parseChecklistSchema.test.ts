import { describe, expect, it } from "vitest";
import { parseCompletionChecklistBlocks } from "../parseChecklistSchema";

describe("parseCompletionChecklistBlocks", () => {
  it("maps seed schema content → label and filters allowlist", () => {
    const blocks = parseCompletionChecklistBlocks({
      version: 1,
      blocks: [
        {
          id: "crit_1",
          type: "completion_criterion",
          label: "Feito?",
          required: true,
          config: { requires_evidence_when_met: true },
        },
        {
          id: "static_1",
          type: "static_text",
          content: "Orientações",
        },
        {
          id: "bad",
          type: "yes_no",
          label: "nope",
        },
      ],
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      id: "crit_1",
      type: "completion_criterion",
      label: "Feito?",
    });
    expect(blocks[1]).toMatchObject({
      id: "static_1",
      type: "static_text",
      label: "Orientações",
    });
  });

  it("returns empty for null/malformed", () => {
    expect(parseCompletionChecklistBlocks(null)).toEqual([]);
    expect(parseCompletionChecklistBlocks({})).toEqual([]);
  });
});
