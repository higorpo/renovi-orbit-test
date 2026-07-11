import { describe, expect, it } from "vitest";
import type { ProposalDetailView } from "../../types/proposalDetails.types";
import type { ProposalComposerFormValues } from "../../types/proposalComposer.types";
import {
  DEFAULT_PROPOSAL_FORM_VALUES,
  mapFormValuesToSuggestedSlots,
  mapProposalDetailToFormValues,
  maskBudgetInput,
  parseCurrencyInputToNumber,
  toInitialPriceInput,
} from "../proposalComposerInput";

describe("proposal composer currency input", () => {
  it.each([
    ["R$ 0012345,678", "12.345,67"],
    ["0,", "0,"],
    ["letters", ""],
  ])("masks %j as %j", (input, expected) => {
    expect(maskBudgetInput(input)).toBe(expected);
  });

  it.each([
    ["1.234,56", 1234.56],
    [" 25,5 ", 25.5],
  ])("parses %j as %j", (input, expected) => {
    expect(parseCurrencyInputToNumber(input)).toBe(expected);
  });

  it.each(["", "0", "-10", "invalid"])("returns null for invalid amount %j", (input) => {
    expect(parseCurrencyInputToNumber(input)).toBeNull();
  });

  it("formats an initial amount with two decimal places", () => {
    expect(toInitialPriceInput(1234.5)).toBe("1.234,50");
    expect(toInitialPriceInput(null)).toBe("");
    expect(toInitialPriceInput(0)).toBe("");
  });
});

describe("proposal composer value mapping", () => {
  it("provides one empty full-day slot by default", () => {
    expect(DEFAULT_PROPOSAL_FORM_VALUES).toEqual({
      priceInput: "",
      descriptionDraft: "",
      durationValueInput: "",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "", endDate: "", shift: "full_day" }],
    });
  });

  it("includes end dates only for day-based proposals", () => {
    const values: ProposalComposerFormValues = {
      ...DEFAULT_PROPOSAL_FORM_VALUES,
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2026-07-15", endDate: "2026-07-17", shift: "morning" },
        { startDate: "2026-07-20", endDate: "", shift: "afternoon" },
      ],
    };

    expect(mapFormValuesToSuggestedSlots(values)).toEqual([
      { start_date: "2026-07-15", end_date: "2026-07-17", shift: "morning" },
      { start_date: "2026-07-20", end_date: null, shift: "afternoon" },
    ]);

    expect(
      mapFormValuesToSuggestedSlots({ ...values, durationUnit: "hours" }),
    ).toEqual([
      { start_date: "2026-07-15", end_date: null, shift: "morning" },
      { start_date: "2026-07-20", end_date: null, shift: "afternoon" },
    ]);
  });

  it("normalizes nullable proposal details into editable form values", () => {
    const proposal = {
      proposed_amount: 1250,
      proposal_description: null,
      proposal_duration_value: null,
      proposal_duration_unit: "weeks",
      proposal_suggested_slots: [],
    } as ProposalDetailView;

    expect(mapProposalDetailToFormValues(proposal)).toEqual({
      priceInput: "1.250,00",
      descriptionDraft: "",
      durationValueInput: "",
      durationUnit: "hours",
      availabilitySlots: [{ startDate: "", endDate: "", shift: "full_day" }],
    });
  });

  it("maps existing suggested slots into editable drafts", () => {
    const proposal = {
      proposed_amount: 100,
      proposal_description: "Install the fixture",
      proposal_duration_value: 2,
      proposal_duration_unit: "days",
      proposal_suggested_slots: [
        {
          start_date: "2026-08-01",
          end_date: null,
          shift: "full_day",
        },
      ],
    } as ProposalDetailView;

    expect(mapProposalDetailToFormValues(proposal)).toEqual({
      priceInput: "100,00",
      descriptionDraft: "Install the fixture",
      durationValueInput: "2",
      durationUnit: "days",
      availabilitySlots: [
        { startDate: "2026-08-01", endDate: "", shift: "full_day" },
      ],
    });
  });
});
