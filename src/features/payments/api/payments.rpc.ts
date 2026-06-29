/**
 * Payment RPC names — single source for payments feature api modules.
 * Mutations and eligibility checks go through supabase.rpc; no direct table writes from hooks/components.
 */
export const PAYMENT_RPC = {
  getCheckoutStepRequirements: "payment_get_checkout_step_requirements",
  getProposalCheckoutContext: "payment_get_proposal_checkout_context",
  calculateInstallmentOptions: "payment_calculate_installment_options",
  revokeClientCardToken: "payment_revoke_client_card_token",
  updatePaymentMethod: "payment_update_method",
} as const;

export type PaymentRpcName = (typeof PAYMENT_RPC)[keyof typeof PAYMENT_RPC];
