export type ProposalDurationUnit = "hours" | "days";

export type ProposalAvailabilityShift = "morning" | "afternoon" | "full_day";

export interface ProposalAvailabilitySlotDraft {
  startDate: string;
  endDate: string;
  shift: ProposalAvailabilityShift;
}

export interface ProposalComposerPricing {
  original_amount: number;
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
  pricing_signature: string;
}

export interface ProposalComposerFormValues {
  priceInput: string;
  descriptionDraft: string;
  durationValueInput: string;
  durationUnit: ProposalDurationUnit;
  availabilitySlots: ProposalAvailabilitySlotDraft[];
}
