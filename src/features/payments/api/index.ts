export { PAYMENT_RPC } from "./payments.rpc";
export type { PaymentRpcName } from "./payments.rpc";
export { PAYMENT_EDGE } from "./payments.edge";
export type { PaymentEdgeFunctionName } from "./payments.edge";
export {
  invokePaymentRpc,
  invokePaymentEdgeFunction,
  trackPaymentApiError,
  mapEdgeErrorPayload,
  paymentsApiErrorToMessage,
} from "./paymentApiClient";
export type { PaymentEdgeInvokeResult } from "./paymentApiClient";

export {
  getCheckoutStepRequirements,
  getProposalCheckoutContext,
  saveCheckoutCpf,
  saveCheckoutPhone,
} from "./checkout.api";
export type {
  GetCheckoutStepRequirementsResult,
  GetProposalCheckoutContextResult,
  SaveCheckoutCpfResult,
  SaveCheckoutPhoneResult,
} from "./checkout.api";

export {
  listActivePaymentTokens,
  fetchPaymentTokenById,
  tokenizePaymentCard,
  mapCardFormToTokenizeRequest,
  fetchInstallmentOptions,
  revokePaymentToken,
  updatePaymentMethod,
} from "./cards.api";
export type {
  TokenizeCardBillingAddress,
  TokenizeCardRequest,
  TokenizeCardSuccess,
  TokenizeCardResult,
  ListActivePaymentTokensResult,
  FetchPaymentTokenResult,
  FetchInstallmentOptionsParams,
  FetchInstallmentOptionsResult,
  BlockedPaymentSchedule,
  RevokePaymentTokenOutcome,
  RevokePaymentTokenResult,
  UpdatePaymentMethodRequest,
  UpdatePaymentMethodResult,
} from "./cards.api";

export {
  manualChargePayment,
  fetchPaymentScheduleByContractedService,
  fetchContractedServicePaymentContext,
} from "./charges.api";
export type {
  ManualChargePaymentRequest,
  ManualChargeOutcome,
  ManualChargePaymentSuccess,
  ManualChargePaymentResult,
  FetchPaymentScheduleResult,
  FetchContractedServicePaymentContextResult,
} from "./charges.api";

export {
  uploadKycDocument,
  validateKycDocumentFile,
  dispatchKycEmail,
  fetchProviderPaymentAccount,
  shouldBlockProviderForKyc,
  isProviderKycPending,
  isProviderKycSubmitting,
} from "./kyc.api";
export type {
  DispatchKycRequest,
  DispatchKycResult,
  UploadKycDocumentResult,
  ProviderPaymentAccount,
  FetchProviderPaymentAccountResult,
} from "./kyc.api";

export {
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
} from "./history.api";
export type {
  ListClientPaymentTransactionsResult,
  ListProviderPaymentReceivablesResult,
} from "./history.api";

import {
  getCheckoutStepRequirements,
  getProposalCheckoutContext,
  saveCheckoutCpf,
  saveCheckoutPhone,
} from "./checkout.api";
import {
  listActivePaymentTokens,
  fetchPaymentTokenById,
  tokenizePaymentCard,
  mapCardFormToTokenizeRequest,
  fetchInstallmentOptions,
  revokePaymentToken,
  updatePaymentMethod,
} from "./cards.api";
import {
  manualChargePayment,
  fetchPaymentScheduleByContractedService,
  fetchContractedServicePaymentContext,
} from "./charges.api";
import {
  uploadKycDocument,
  dispatchKycEmail,
  fetchProviderPaymentAccount,
} from "./kyc.api";
import {
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
} from "./history.api";

export const paymentsApi = {
  checkout: {
    getStepRequirements: getCheckoutStepRequirements,
    getProposalCheckoutContext,
    saveCpf: saveCheckoutCpf,
    savePhone: saveCheckoutPhone,
  },
  cards: {
    listActiveTokens: listActivePaymentTokens,
    fetchTokenById: fetchPaymentTokenById,
    tokenize: tokenizePaymentCard,
    mapCardFormToTokenizeRequest,
    fetchInstallmentOptions,
    revoke: revokePaymentToken,
    updateMethod: updatePaymentMethod,
  },
  charges: {
    manualCharge: manualChargePayment,
    fetchScheduleByContractedService: fetchPaymentScheduleByContractedService,
    fetchContractedServiceContext: fetchContractedServicePaymentContext,
  },
  kyc: {
    uploadDocument: uploadKycDocument,
    dispatchEmail: dispatchKycEmail,
    fetchProviderAccount: fetchProviderPaymentAccount,
  },
  history: {
    listClientTransactions: listClientPaymentTransactions,
    listProviderReceivables: listProviderPaymentReceivables,
  },
};
