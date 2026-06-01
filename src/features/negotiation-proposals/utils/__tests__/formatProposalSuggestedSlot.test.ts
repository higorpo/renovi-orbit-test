import { describe, expect, it } from "vitest";
import { formatProposalSuggestedSlot } from "../formatProposalSuggestedSlot";

describe("formatProposalSuggestedSlot", () => {
  it("formats single-day slot with shift", () => {
    expect(
      formatProposalSuggestedSlot({
        start_date: "2030-06-15",
        end_date: null,
        shift: "morning",
      }),
    ).toContain("15/06/2030");
  });

  it("formats date range when end_date differs", () => {
    const label = formatProposalSuggestedSlot({
      start_date: "2030-06-15",
      end_date: "2030-06-17",
      shift: "full_day",
    });

    expect(label).toContain("–");
    expect(label).toContain("Dia inteiro");
  });
});
