export type PaymentScheduleSummary = {
  id: string;
  contractedServiceId: string;
  state: string;
  paymentTokenId: string | null;
  installmentNumber: number;
  baseAmount: number | null;
  failureReason: string | null;
  failureCode: string | null;
  isDisputed: boolean;
  paidAt: string | null;
};

export type PaymentScheduleLifecycle = {
  contractedServiceId: string;
  state: string;
  chargeScheduledAt: string | null;
};

export type ContractedServicePaymentContext = {
  acceptedProposalId: string;
  serviceRequestId: string;
};

export const MANUAL_PAYMENT_ELIGIBLE_STATES = ["FAILED", "FAILED_PERMANENT"] as const;

export function isManualPaymentEligible(state: string): boolean {
  return MANUAL_PAYMENT_ELIGIBLE_STATES.includes(
    state as (typeof MANUAL_PAYMENT_ELIGIBLE_STATES)[number],
  );
}
