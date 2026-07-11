import { describe, expect, it } from "vitest";
import { parseProposalSuggestedSlots } from "../parseProposalSuggestedSlots";

describe("parseProposalSuggestedSlots", () => {
  it("returns suggested slot arrays unchanged", () => {
    const slots = [
      {
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        shift: "morning",
      },
    ];

    expect(parseProposalSuggestedSlots(slots)).toBe(slots);
  });

  it.each([null, undefined, {}, "[]", 1])(
    "returns an empty array for non-array value %j",
    (value) => {
      expect(parseProposalSuggestedSlots(value)).toEqual([]);
    },
  );

  it("accepts an empty suggested slot array", () => {
    expect(parseProposalSuggestedSlots([])).toEqual([]);
  });
});
