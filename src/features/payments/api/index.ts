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
  fetchInstallmentOptions,
  acceptProposalWithPayment,
  saveCheckoutCpf,
  saveCheckoutPhone,
} from "./checkout.api";
export type {
  GetCheckoutStepRequirementsResult,
  GetProposalCheckoutContextResult,
  FetchInstallmentOptionsParams,
  FetchInstallmentOptionsResult,
  AcceptProposalWithPaymentResult,
  AcceptProposalCheckoutParams,
  AcceptProposalCheckoutResult,
  SaveCheckoutCpfResult,
  SaveCheckoutPhoneResult,
} from "./checkout.api";

export { issueClearSaleSession } from "./clearsale.api";
export type {
  ClearSaleSessionPurpose,
  IssueClearSaleSessionParams,
  IssueClearSaleSessionResult,
} from "./clearsale.api";

export {
  listActivePaymentTokens,
  fetchPaymentTokenById,
  tokenizePaymentCard,
  mapCardFormToTokenizeRequest,
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
  BlockedPaymentSchedule,
  RevokePaymentTokenOutcome,
  RevokePaymentTokenResult,
  UpdatePaymentMethodRequest,
  UpdatePaymentMethodResult,
} from "./cards.api";

export {
  manualChargePayment,
  fetchPaymentScheduleByContractedService,
  fetchPaymentScheduleLifecycleByContractedService,
  fetchContractedServicePaymentContext,
} from "./charges.api";
export type {
  ManualChargePaymentRequest,
  ManualChargeOutcome,
  ManualChargePaymentSuccess,
  ManualChargePaymentResult,
  FetchPaymentScheduleResult,
  FetchPaymentScheduleLifecycleResult,
  FetchContractedServicePaymentContextResult,
} from "./charges.api";

export {
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
} from "./history.api";
export type {
  ListClientPaymentTransactionsResult,
  ListProviderPaymentReceivablesResult,
} from "./history.api";

export { processContractedServiceRefund } from "./refund.api";
export type {
  ProcessRefundOutcome,
  ProcessRefundSuccess,
  ProcessRefundResult,
} from "./refund.api";

import {
  getCheckoutStepRequirements,
  getProposalCheckoutContext,
  fetchInstallmentOptions,
  acceptProposalWithPayment,
  saveCheckoutCpf,
  saveCheckoutPhone,
} from "./checkout.api";
import {
  listActivePaymentTokens,
  fetchPaymentTokenById,
  tokenizePaymentCard,
  mapCardFormToTokenizeRequest,
  revokePaymentToken,
  updatePaymentMethod,
} from "./cards.api";
import {
  manualChargePayment,
  fetchPaymentScheduleByContractedService,
  fetchPaymentScheduleLifecycleByContractedService,
  fetchContractedServicePaymentContext,
} from "./charges.api";
import { issueClearSaleSession } from "./clearsale.api";
import {
  listClientPaymentTransactions,
  listProviderPaymentReceivables,
} from "./history.api";
import { processContractedServiceRefund } from "./refund.api";

export const paymentsApi = {
  checkout: {
    getStepRequirements: getCheckoutStepRequirements,
    getProposalCheckoutContext,
    fetchInstallmentOptions,
    acceptProposalWithPayment,
    saveCpf: saveCheckoutCpf,
    savePhone: saveCheckoutPhone,
    issueClearSaleSession,
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
    fetchScheduleLifecycleByContractedService: fetchPaymentScheduleLifecycleByContractedService,
    fetchContractedServiceContext: fetchContractedServicePaymentContext,
  },
  history: {
    listClientTransactions: listClientPaymentTransactions,
    listProviderReceivables: listProviderPaymentReceivables,
  },
  refunds: {
    processContractedService: processContractedServiceRefund,
  },
};
