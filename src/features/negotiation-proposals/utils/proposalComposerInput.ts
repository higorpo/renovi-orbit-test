import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ProposalComposerFormValues } from "../types/proposalComposer.types";
import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";

export const DEFAULT_PROPOSAL_FORM_VALUES: ProposalComposerFormValues = {
  priceInput: "",
  descriptionDraft: "",
  durationValueInput: "",
  durationUnit: "hours",
  availabilitySlots: [{ startDate: "", endDate: "", shift: "full_day" }],
};

export function maskBudgetInput(value: string): string {
  const sanitized = value.replace(/[^\d,]/g, "");
  if (!sanitized) return "";

  const hasComma = sanitized.includes(",");
  const [rawIntegerPart = "", rawDecimalPart = ""] = sanitized.split(",", 2);
  const normalizedIntegerPart = rawIntegerPart.replace(/^0+(?=\d)/, "");
  const integerDigits = normalizedIntegerPart || "0";
  const formattedIntegerPart = new Intl.NumberFormat("pt-BR").format(
    Number.parseInt(integerDigits, 10),
  );

  if (!hasComma) return formattedIntegerPart;
  return `${formattedIntegerPart},${rawDecimalPart.slice(0, 2)}`;
}

export function parseCurrencyInputToNumber(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function toInitialPriceInput(amount: number | null): string {
  if (typeof amount !== "number" || amount <= 0) return "";
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function mapFormValuesToSuggestedSlots(
  values: ProposalComposerFormValues,
): ProposalSuggestedSlotRpc[] {
  return values.availabilitySlots.map((slot) => ({
    start_date: slot.startDate,
    end_date: values.durationUnit === "days" ? slot.endDate || null : null,
    shift: slot.shift,
  }));
}

export function mapProposalDetailToFormValues(
  proposal: ProposalDetailView,
): ProposalComposerFormValues {
  return {
    priceInput: toInitialPriceInput(proposal.proposed_amount),
    descriptionDraft: proposal.proposal_description ?? "",
    durationValueInput:
      typeof proposal.proposal_duration_value === "number"
        ? String(proposal.proposal_duration_value)
        : "",
    durationUnit: proposal.proposal_duration_unit === "days" ? "days" : "hours",
    availabilitySlots:
      proposal.proposal_suggested_slots.length > 0
        ? proposal.proposal_suggested_slots.map((slot) => ({
            startDate: slot.start_date,
            endDate: slot.end_date ?? "",
            shift: slot.shift,
          }))
        : [{ startDate: "", endDate: "", shift: "full_day" }],
  };
}
