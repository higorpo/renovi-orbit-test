/**
 * PaymentProvider abstraction — gateway-agnostic contract (design §5.1, Req 1).
 * Edge Function business logic MUST depend on these types only, never on NetCred/GraphQL types.
 */

/** Monetary amount as decimal string (avoids IEEE-754 drift). */
export type Decimal = string;

export type PaymentMethodType = "CREDIT_CARD" | "PIX" | "BOLETO";

export type GatewayTransactionState =
  | "PAID"
  | "IN_ANALYSIS"
  | "REJECTED"
  | "VOIDED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CANCELLED"
  | "EXPIRED"
  | "SCHEDULED"
  | "REFUND_REQUESTED";

export type ChargeErrorCode =
  | "TERMINAL"
  | "RETRYABLE"
  | "AUTH_FAILURE"
  | "REFERENCE_CODE_CONFLICT";

export type ChargeError = {
  code: ChargeErrorCode;
  message: string;
  originalCode?: string;
};

export type RefundErrorCode =
  | "ALREADY_REFUNDED"
  | "TRANSACTION_NOT_FOUND"
  | "INVALID_REFUND_AMOUNT"
  | "UNKNOWN";

export type RefundError = {
  code: RefundErrorCode;
  message: string;
};

export type CreditCardCharge = {
  type: "CREDIT_CARD";
  installmentNumber: number;
  paymentProfileId: string;
  paymentToken: string;
};

export type PixCharge = {
  type: "PIX";
  expiresAt: Date;
};

export type BoletoCharge = {
  type: "BOLETO";
  dueDate: Date;
};

export type PaymentMethodCharge = CreditCardCharge | PixCharge | BoletoCharge;

export type PayoutRuleReceiver = "provider" | "platform";

export type PayoutRuleItem = {
  type: "FIXED_AMOUNT" | "PERCENTAGE";
  receiver: PayoutRuleReceiver;
  amount?: Decimal;
  percentage?: number;
  isLiable: boolean;
};

export type PayoutRuleInput = {
  providerAccount: {
    netcredCompanyId: string;
    netcredBankAccountId: string;
  };
  ruleItems: PayoutRuleItem[];
};

/** referenceCode MUST be contracted_service_id (UUID string). */
export type CreateChargeInput = {
  referenceCode: string;
  amount: Decimal;
  paymentMethod: PaymentMethodCharge;
  payoutRule: PayoutRuleInput;
  sessionId?: string;
  customerIpAddress?: string;
};

export type CreateChargeResult = {
  success: boolean;
  transactionState?: Extract<
    GatewayTransactionState,
    "PAID" | "IN_ANALYSIS" | "REJECTED" | "VOIDED"
  >;
  chargeId?: string;
  transactionId?: string;
  error?: ChargeError;
};

export type BillingAddress = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
  additionalDetails?: string;
};

export type TokenizeCardData = {
  cardNumber: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
};

export type TokenizeCustomerInput = {
  companyId: string;
  persist: boolean;
};

export type TokenizeCardInput = {
  cardData: TokenizeCardData;
  billingAddress: BillingAddress;
  customerInput: TokenizeCustomerInput;
  cpf?: string;
  phone?: string;
};

export type TokenizeCardGatewayError = {
  message: string;
  code?: string;
};

export type TokenizeCardResult = {
  isActive: boolean;
  paymentProfileId?: string;
  cardNumberMasked?: string;
  cardBrand?: string;
  token?: string;
  errors?: TokenizeCardGatewayError[];
};

export type VoidChargeInput = {
  chargeId: string;
  transactionId?: string;
  referenceCode?: string;
};

export type VoidChargeResult = {
  success: boolean;
  error?: ChargeError;
};

export type RefundTransactionInput = {
  transactionId: string;
  amount?: Decimal;
  referenceCode?: string;
};

export type RefundTransactionResult = {
  success: boolean;
  error?: RefundError;
};

/** referenceCode MUST be contracted_service_id (UUID string). */
export type GetTransactionInput = {
  referenceCode: string;
  /** NetCred companyId scope for the transactions query (provider merchant). */
  companyId?: string;
};

/**
 * Null means the gateway has no transaction for the referenceCode —
 * callers treat this as "no prior charge exists".
 */
export type GetTransactionResult = {
  transactionId: string;
  chargeId?: string;
  referenceCode: string;
  transactionState: GatewayTransactionState;
  paidAmount?: Decimal;
  refundedAmount?: Decimal;
};

export type ProcessWebhookInput = {
  gatewaySlug: string;
  eventType: string;
  providerEventId: string;
  rawPayload: Record<string, unknown>;
  rawHeaders: Record<string, string>;
  webhookEventId: string;
};

export type ProcessWebhookResult = {
  handled: boolean;
  scheduleId?: string;
  serviceId?: string;
  fromState?: string;
  toState?: string;
  skippedReason?: string;
};

export type ProviderCredentials = {
  document: string;
  companyId: string;
  bankAccountId?: string;
  onboardingStatus?: string;
};

export interface PaymentProvider {
  tokenizeCard(input: TokenizeCardInput): Promise<TokenizeCardResult>;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  voidCharge(input: VoidChargeInput): Promise<VoidChargeResult>;
  refundTransaction(
    input: RefundTransactionInput,
  ): Promise<RefundTransactionResult>;
  getTransaction(
    input: GetTransactionInput,
  ): Promise<GetTransactionResult | null>;
  processWebhookEvent(
    input: ProcessWebhookInput,
  ): Promise<ProcessWebhookResult>;
  getProviderCredentials(
    document: string,
  ): Promise<ProviderCredentials | null>;
  refreshAuthToken(): Promise<void>;
}
