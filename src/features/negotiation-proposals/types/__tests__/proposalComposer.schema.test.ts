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

  it("rejects duration greater than 24 hours", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço rápido.",
      durationValueInput: "25",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "2030-06-01", endDate: "", shift: "morning" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "durationValueInput")).toBe(
        true,
      );
    }
  });

  it("accepts day range spanning a weekend when working-day count matches", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço em 3 dias úteis.",
      durationValueInput: "3",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2026-06-05", endDate: "2026-06-09", shift: "full_day" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts calendar span Fri–Sun for 3-day duration", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço em 3 dias corridos.",
      durationValueInput: "3",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2026-06-05", endDate: "2026-06-07", shift: "full_day" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects when neither calendar nor working-day count matches", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço em 3 dias.",
      durationValueInput: "3",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2026-06-05", endDate: "2026-06-08", shift: "full_day" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duration greater than 7 days", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço longo.",
      durationValueInput: "8",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2030-06-01", endDate: "2030-06-08", shift: "full_day" },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "durationValueInput")).toBe(
        true,
      );
    }
  });
});
