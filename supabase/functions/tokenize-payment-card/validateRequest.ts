import type { BillingAddress, TokenizeCardData } from "../_shared/payment/types.ts";
import { isValidCpf, normalizeCpf } from "./validateCpf.ts";
import type { TokenizePaymentCardBody } from "./types.ts";

export type ParsedTokenizeRequest = {
  cardData: TokenizeCardData;
  billingAddress: BillingAddress;
  providerServiceId?: string;
  tokenizeContext: "checkout" | "profile";
  cpf?: string;
  phone?: string;
};

export type TokenizeValidationError = {
  status: 400 | 422;
  error: string;
  errors?: Array<{ message: string; code?: string }>;
};

function isBillingAddressComplete(
  billingAddress: BillingAddress | undefined,
): billingAddress is BillingAddress {
  if (!billingAddress) return false;

  return Boolean(
    billingAddress.street?.trim() &&
      billingAddress.number?.trim() &&
      billingAddress.district?.trim() &&
      billingAddress.city?.trim() &&
      billingAddress.state?.trim() &&
      billingAddress.zipCode?.trim(),
  );
}

function isCardDataComplete(cardData: TokenizeCardData | undefined): cardData is TokenizeCardData {
  if (!cardData) return false;

  return Boolean(
    cardData.cardNumber?.trim() &&
      cardData.cvv?.trim() &&
      cardData.cardholderName?.trim() &&
      Number.isFinite(cardData.expiryMonth) &&
      cardData.expiryMonth >= 1 &&
      cardData.expiryMonth <= 12 &&
      Number.isFinite(cardData.expiryYear) &&
      cardData.expiryYear >= 2000,
  );
}

export function validateTokenizePaymentCardBody(
  body: TokenizePaymentCardBody,
): ParsedTokenizeRequest | TokenizeValidationError {
  const tokenizeContext = body.tokenizeContext === "profile" ? "profile" : "checkout";

  if (tokenizeContext === "checkout" && !body.providerServiceId?.trim()) {
    return { status: 400, error: "providerServiceId is required" };
  }

  if (!isCardDataComplete(body.cardData)) {
    return { status: 400, error: "cardData is incomplete" };
  }

  if (!isBillingAddressComplete(body.billingAddress)) {
    return {
      status: 422,
      error: "billing_address_required",
      errors: [{ message: "BILLING_ADDRESS_REQUIRED", code: "BILLING_ADDRESS_REQUIRED" }],
    };
  }

  if (body.cpf && !isValidCpf(body.cpf)) {
    return {
      status: 422,
      error: "invalid_cpf",
      errors: [{ message: "CPF_INVALID", code: "CPF_INVALID" }],
    };
  }

  return {
    cardData: body.cardData,
    billingAddress: body.billingAddress,
    providerServiceId: body.providerServiceId?.trim(),
    tokenizeContext,
    cpf: body.cpf ? normalizeCpf(body.cpf) : undefined,
    phone: body.phone?.replace(/\D/g, ""),
  };
}
