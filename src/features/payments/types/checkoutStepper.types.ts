import type { InstallmentHmacPayload, InstallmentOption } from "./paymentToken.types";
import type { ProposalSuggestedSlotRpc } from "@/features/negotiation-proposals";

export type CheckoutStepId =
  | "cpf"
  | "phone"
  | "card"
  | "installments"
  | "confirmation";

export type CheckoutStepRequirements = {
  needs_cpf: boolean;
  needs_phone: boolean;
  needs_card: boolean;
};

export type CheckoutStepData = {
  cpf?: string;
  phone?: string;
  cardTokenId?: string;
  cardBrand?: string;
  installmentNumber?: number;
  hmac?: string;
  installmentAmount?: number;
  totalWithFees?: number;
  installmentOptions?: InstallmentOption[];
  installmentComputedAt?: string;
  installmentExpiresAt?: string;
  installmentHmacPayload?: InstallmentHmacPayload;
};

export type CheckoutContext = {
  serviceTitle: string;
  scheduledDate: string;
  baseAmount: number;
  providerId?: string;
  selectedSlot: ProposalSuggestedSlotRpc;
  pricingSignature: string;
};

export type ProposalCheckoutContext = {
  proposalId: string;
  serviceRequestId: string;
  providerId: string;
  proposedAmount: number;
  pricingSignature: string;
};
