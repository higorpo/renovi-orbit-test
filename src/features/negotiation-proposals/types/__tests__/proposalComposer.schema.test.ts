import { describe, expect, it } from "vitest";
import {
  getInclusiveDayRangeHint,
  getProposalComposerFieldError,
  validateProposalComposerForm,
} from "../proposalComposer.schema";

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

  it("rejects single-day duration when unit is days", () => {
    const result = validateProposalComposerForm({
      priceInput: "500,00",
      descriptionDraft: "Serviço em um dia.",
      durationValueInput: "1",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2030-06-01", endDate: "2030-06-01", shift: "full_day" },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "durationUnit")).toBe(true);
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes("use a unidade em horas"),
        ),
      ).toBe(true);
    }
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
        { startDate: "2030-06-14", endDate: "2030-06-18", shift: "full_day" },
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
        { startDate: "2030-06-14", endDate: "2030-06-16", shift: "full_day" },
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

  it("rejects empty availability slots", () => {
    const result = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "2",
      durationUnit: "hours",
      availabilitySlots: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "availabilitySlots"),
      ).toBe(true);
    }
  });

  it("rejects invalid and past start dates", () => {
    const invalid = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "2",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "not-a-date", endDate: "", shift: "morning" }],
    });
    expect(invalid.success).toBe(false);

    const past = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "2",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "2020-01-01", endDate: "", shift: "morning" }],
    });
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(
        past.error.issues.some((issue) =>
          issue.message.includes("a partir de amanhã"),
        ),
      ).toBe(true);
    }
  });

  it("rejects inverted day ranges and invalid end dates", () => {
    const inverted = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "2",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2030-06-10", endDate: "2030-06-09", shift: "full_day" },
      ],
    });
    expect(inverted.success).toBe(false);

    const invalidEnd = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "2",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2030-06-10", endDate: "bad-date", shift: "full_day" },
      ],
    });
    expect(invalidEnd.success).toBe(false);
  });

  it("rejects zero duration values", () => {
    const result = validateProposalComposerForm({
      priceInput: "100,00",
      descriptionDraft: "Descrição válida do orçamento.",
      durationValueInput: "0",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "2030-06-01", endDate: "", shift: "morning" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("getProposalComposerFieldError", () => {
  it("returns the matching issue message", () => {
    const result = validateProposalComposerForm({
      priceInput: "",
      descriptionDraft: "ok",
      durationValueInput: "2",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "2030-06-01", endDate: "", shift: "morning" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getProposalComposerFieldError(result.error.issues, ["priceInput"])).toMatch(
        /quanto você quer cobrar/i,
      );
      expect(getProposalComposerFieldError(result.error.issues, ["missing"])).toBeNull();
    }
  });
});

describe("getInclusiveDayRangeHint", () => {
  it("returns null for incomplete or invalid dates", () => {
    expect(getInclusiveDayRangeHint("", "2030-06-02")).toBeNull();
    expect(getInclusiveDayRangeHint("not-a-date", "2030-06-02")).toBeNull();
  });

  it("flags inverted ranges", () => {
    expect(getInclusiveDayRangeHint("2030-06-05", "2030-06-01")).toEqual({
      message: "A data final não pode ser anterior à inicial.",
      isError: true,
    });
  });

  it("summarizes calendar and working days", () => {
    const hint = getInclusiveDayRangeHint("2030-06-14", "2030-06-16");
    expect(hint?.isError).toBe(false);
    expect(hint?.message).toMatch(/dias corridos/);
    expect(hint?.message).toMatch(/dia útil/);
  });
});
