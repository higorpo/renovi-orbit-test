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
  /** Server America/Sao_Paulo execution instant; preferred for cancel disclosure (CHK-038). */
  serviceExecutionAt: string | null;
  /** Service price before card fees. Present for the client via history view when paid. */
  baseAmount: number | null;
  /** Total charged to the card. Present for the client via history view when paid. */
  paidAmount: number | null;
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
