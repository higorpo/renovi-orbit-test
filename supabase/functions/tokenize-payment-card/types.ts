import type { BillingAddress, TokenizeCardData } from "../_shared/payment/types.ts";

export type TokenizePaymentCardContext = "checkout" | "profile";

export type TokenizePaymentCardBody = {
  cardData?: TokenizeCardData;
  cpf?: string;
  phone?: string;
  billingAddress?: BillingAddress;
  providerServiceId?: string;
  tokenizeContext?: TokenizePaymentCardContext;
};

export type ResolvedProviderAccount = {
  providerUserId: string;
  netcredCompanyId: string;
};

export type TokenizePaymentCardSuccess = {
  payment_token_id: string;
  card_number_masked: string;
  card_brand: string;
};
