export type PaymentMethodType = "CREDIT_CARD" | "PIX" | "BOLETO";

/**
 * PaymentProvider contract for Edge adapters (design.md §5.1).
 * Full interface is implemented in `_shared/payment/` (task 61+).
 */
export type PaymentProviderMethod =
  | "tokenizeCard"
  | "createCharge"
  | "voidCharge"
  | "refundTransaction"
  | "getTransaction"
  | "processWebhookEvent"
  | "getProviderCredentials"
  | "refreshAuthToken";
