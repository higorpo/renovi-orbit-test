/**
 * Payment Edge Function slugs — single source for payments feature api modules.
 * PCI and external I/O only; business logic stays in PostgreSQL RPCs.
 */
export const PAYMENT_EDGE = {
  tokenizePaymentCard: "tokenize-payment-card",
  manualChargePayment: "manual-charge-payment",
  dispatchKycEmail: "dispatch-kyc-email",
} as const;

export type PaymentEdgeFunctionName = (typeof PAYMENT_EDGE)[keyof typeof PAYMENT_EDGE];
