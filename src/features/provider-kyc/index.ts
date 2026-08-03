/**
 * Provider KYC feature — Public API.
 *
 * External consumers import from `@/features/provider-kyc` only.
 * Internal modules (api/, hooks/, components/) must not be imported across features.
 */

export { ProviderKycForm, ProviderKycGate, BankPicker } from "./components";
export type { ProviderKycFormProps, BankPickerProps } from "./components";

export {
  useDispatchKyc,
  useRetryKycEmailDispatch,
  useProviderPaymentAccount,
  useProviderKycWizard,
  PROVIDER_PAYMENT_ACCOUNT_QUERY_KEY,
} from "./hooks";

export {
  shouldBlockProviderForKyc,
  isProviderCredentialed,
  isProviderKycPending,
  isProviderKycSubmitting,
  isProviderKycDocumentsSubmitted,
  isProviderKycAwaitingReview,
  isProviderKycRejected,
  isProviderKycSuspended,
  uploadKycDocument,
  validateKycDocumentFile,
  createKycUploadSession,
  registerKycUploadPath,
  submitProviderKyc,
  dispatchKycEmail,
  retryProviderKycEmailDispatch,
  fetchProviderPaymentAccount,
  fetchProviderPrivateProfileForKyc,
} from "./api";
export type {
  DispatchKycRequest,
  SubmitProviderKycRequest,
  SubmitProviderKycResult,
  DispatchKycResult,
  UploadKycDocumentResult,
  ProviderPaymentAccount,
  FetchProviderPaymentAccountResult,
  ProviderPrivateProfileForKyc,
  FetchProviderPrivateProfileForKycResult,
} from "./api";
