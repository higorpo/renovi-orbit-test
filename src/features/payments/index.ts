/**
 * Payments feature — Public API.
 *
 * External consumers import from `@/features/payments` only.
 * Internal modules (api/, hooks/, components/) must not be imported across features.
 */

export type {
  ContractedServicePaymentStatus,
  PaymentGatewaySlug,
  PaymentMethodType,
  PaymentProviderMethod,
  PaymentScheduleState,
  PaymentWebhookEventState,
  PAYMENT_GATEWAY_SLUG,
  SUPPORTED_PAYMENT_METHODS,
  SupportedPaymentMethod,
  CheckoutStepData,
  CheckoutStepId,
  CheckoutStepRequirements,
  CheckoutContext,
  ProposalCheckoutContext,
} from "./types";

export { CheckoutStepper } from "./components";
export type { CheckoutStepperProps } from "./components";

export {
  useCheckoutStepper,
  CHECKOUT_STEP_REQUIREMENTS_QUERY_KEY,
} from "./hooks";
export type { UseCheckoutStepperOptions } from "./hooks";

export {
  getCheckoutStepRequirements,
  getProposalCheckoutContext,
  fetchInstallmentOptions,
  acceptProposalWithPayment,
  saveCheckoutCpf,
  saveCheckoutPhone,
  tokenizePaymentCard,
  mapCardFormToTokenizeRequest,
  listActivePaymentTokens,
  revokePaymentToken,
  manualChargePayment,
  fetchPaymentScheduleByContractedService,
  fetchPaymentScheduleLifecycleByContractedService,
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
  paymentsApi,
} from "./api";

export { resolveCheckoutSteps } from "./utils/resolveCheckoutSteps";
export { mapCheckoutStepperError } from "./utils/mapCheckoutStepperError";
export {
  mapPaymentUserMessage,
  mapPaymentErrorToUserMessage,
} from "./utils/mapPaymentUserMessage";
export { getChargeTimingDisclosure } from "./utils/chargeTimingDisclosure";
export { validateCPF, validateCNPJ } from "@/lib/validators";
export { maskCNPJ } from "@/lib/masks";
export { generateClearSaleSessionId } from "./utils/generateClearSaleSessionId";
export { injectClearSaleSdk } from "./utils/injectClearSaleSdk";
export { maskCardNumber, isValidLuhn } from "./utils/card-validator";

export {
  CpfStep,
  PhoneStep,
  CardStep,
  CardForm,
  SavedCardSelector,
  InstallmentSelector,
  ConfirmationStep,
  PaymentTrustDisclosure,
  ProviderKycForm,
  ProviderKycGate,
  SavedCardsList,
  ManualPaymentButton,
  ManualPaymentRecovery,
  ManualPaymentFailureAlert,
  ManualPaymentModal,
  ContractedServiceCancelAction,
  PaymentHistorySection,
  PaymentDisputeBadge,
  PaymentDisputeStatus,
  ProviderSettlementDisclosure,
  ProviderSettlementStatus,
} from "./components";
export type { PaymentHistoryRole } from "./components";
export {
  useTokenizeCard,
  useSavedPaymentTokens,
  useInstallmentOptions,
  useInstallmentSignatureRecovery,
  useDispatchKyc,
  useProviderPaymentAccount,
  PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY,
  useSavedCards,
  usePaymentSchedule,
  PAYMENT_SCHEDULE_QUERY_KEY,
  usePaymentScheduleLifecycle,
  PAYMENT_SCHEDULE_LIFECYCLE_QUERY_KEY,
  useManualChargePayment,
  useProcessRefund,
  useClientPaymentHistory,
  CLIENT_PAYMENT_HISTORY_QUERY_KEY,
  useProviderPaymentHistory,
  PROVIDER_PAYMENT_HISTORY_QUERY_KEY,
  useProposalCheckoutContext,
  PROPOSAL_CHECKOUT_CONTEXT_QUERY_KEY,
} from "./hooks";
export { isManualPaymentEligible } from "./types/paymentSchedule.types";
export type { PaymentScheduleSummary, PaymentScheduleLifecycle } from "./types/paymentSchedule.types";
export type { CancellationViewerRole } from "./utils/contractedServiceCancellation";
export type {
  ClientPaymentTransaction,
  ProviderPaymentReceivable,
} from "./types/paymentHistory.types";
export type { CpfStepFormData } from "./types/cpfStep.validation";
export type { PhoneStepFormData } from "./types/phoneStep.validation";
export type {
  SavedPaymentToken,
  SavedCardSelection,
  CardFormData,
  InstallmentOption,
  InstallmentSelection,
} from "./types";
export type { TokenizeCardSuccess } from "./api";
