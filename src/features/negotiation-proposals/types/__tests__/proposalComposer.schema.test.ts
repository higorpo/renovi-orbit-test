import { describe, expect, it } from "vitest";
import { validateProposalComposerForm } from "../proposalComposer.schema";

describe("validateProposalComposerForm", () => {
  it("accepts a valid hours-based draft", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Pintura completa com massa corrida.",
      durationValueInput: "8",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "2030-06-01", endDate: "", shift: "morning" }],
    });

    expect(result.success).toBe(true);
  });

  it("requires end date when duration unit is days", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço em 3 dias.",
      durationValueInput: "3",
      durationUnit: "days",
      availabilitySlots: [{ startDate: "2030-06-01", endDate: "", shift: "full_day" }],
    });

    expect(result.success).toBe(false);
  });
});
