/**
 * Negotiation proposals feature — Public API (design §13.9).
 *
 * Proposal composer and accept/reject flows live here (extracted from provider-jobs in task 97).
 * Do not import from api/, hooks/, components/, or types/ paths directly.
 */

export { CNS_PROPOSAL_RPC, type CnsProposalRpcName } from "./api/proposals.rpc";
export {
  proposalsApi,
  createProviderProposal,
  acceptProposalWithPayment,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
  getProposalDetail,
  getLatestProviderProposalForServiceRequest,
  fetchProviderProposalHistory,
} from "./api/proposals.api";
export {
  calculateProposalPricing,
  getProposalPhotoDisplayUrl,
  uploadProposalPhotos,
} from "./api/proposalComposerSupport.api";

export type {
  ProposalStatus,
  ProposalRevisionReason,
  RevisionRequestInitialValues,
  ProposalSuggestedSlotShift,
  ProposalSuggestedSlotRpc,
  ProposalVersionListResponse,
  AcceptProposalResult,
  AcceptProposalMutationParams,
  AcceptProposalMutationResult,
  AcceptProposalWithPaymentParams,
  ProposalMutationResult,
  ProposalBusinessErrorCode,
  ProposalsApiError,
  ProposalsApiResult,
  ProviderProposalHistoryItem,
  CreateProviderProposalParams,
  CreateProviderProposalResult,
} from "./types/proposals.types";

export { mapProposalRpcError } from "./utils/proposalApiErrors";

export {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_PHOTOS,
  PROPOSAL_PRICING_DEBOUNCE_MS,
} from "./constants/proposalComposer";
export {
  ProposalComposer,
  type ProposalComposerProps,
} from "./components/ProposalComposer";
export {
  ProposalComposerDialog,
  type ProposalComposerDialogProps,
} from "./components/ProposalComposerDialog";
export {
  ProposalComposerShellDialog,
  type ProposalComposerShellDialogProps,
} from "./components/ProposalComposerShellDialog";
export {
  ProposalDetailsDialog,
  type ProposalDetailsDialogProps,
  type ProposalDetailsContent,
} from "./components/ProposalDetailsDialog";
export {
  ServiceRequestProposalSummaryCard,
  type ServiceRequestProposalSummaryCardProps,
} from "./components/ServiceRequestProposalSummaryCard";
export type { ProposalSummaryHeadingSize } from "./constants/proposalSummaryHeading";
export { ServiceRequestProposalSummaryCardSkeleton } from "./components/ServiceRequestProposalSummaryCardSkeleton";
export {
  ProposalHistoryAccordion,
} from "./components/ProposalHistoryAccordion";
export { ProposalPhotosGrid } from "./components/ProposalPhotosGrid";
export {
  ProposalRevisionRequestNotice,
  type ProposalRevisionRequestNoticeProps,
} from "./components/ProposalRevisionRequestNotice";
export {
  ProposalClientRejectionNotice,
  type ProposalClientRejectionNoticeProps,
} from "./components/ProposalClientRejectionNotice";
export {
  createProposalComposerSchema,
  validateProposalComposerForm,
  getProposalComposerFieldError,
  getInclusiveDayRangeHint,
  proposalAvailabilitySlotSchema,
} from "./types/proposalComposer.schema";
export type {
  ProposalAvailabilitySlotDraft,
  ProposalAvailabilityShift,
  ProposalComposerFormValues,
  ProposalComposerPricing,
  ProposalDurationUnit,
} from "./types/proposalComposer.types";
export type { ProposalComposerMode } from "./types/proposalComposerMode.types";

export { MAX_PROPOSAL_REVISIONS } from "./constants/proposalRevisions";
export {
  PROPOSAL_STATUSES,
  defineProposalStatusMap,
  coerceProposalStatus,
  isProposalStatus,
  assertProposalStatusExhaustive,
} from "./constants/proposalStatus";
export { AcceptProposalDialog, type AcceptProposalDialogProps } from "./components/AcceptProposalDialog";
export { RejectProposalDialog, type RejectProposalDialogProps } from "./components/RejectProposalDialog";
export {
  RevisionRequestDialog,
  type RevisionRequestDialogProps,
} from "./components/RevisionRequestDialog";
export {
  ProposalRevisionCounter,
  type ProposalRevisionCounterProps,
} from "./components/ProposalRevisionCounter";
export {
  useAcceptProposalMutation,
  useRejectProposalMutation,
  useRequestProposalRevisionMutation,
} from "./hooks/useProposalClientMutations";
export { useProposalComposer, type UseProposalComposerOptions } from "./hooks/useProposalComposer";
export {
  useServiceRequestProposalComposer,
  type UseServiceRequestProposalComposerOptions,
} from "./hooks/useServiceRequestProposalComposer";
export { useProposalComposerForm } from "./hooks/useProposalComposerForm";
export { useProposalDetail, type UseProposalDetailParams } from "./hooks/useProposalDetail";
export { useProposalHistory } from "./hooks/useProposalHistory";
export { useLatestProviderProposal } from "./hooks/useLatestProviderProposal";
export {
  PROPOSAL_DETAIL_QUERY_KEY,
  PROPOSAL_HISTORY_QUERY_KEY,
  SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY,
  LATEST_PROVIDER_PROPOSAL_QUERY_KEY,
} from "./constants/queryKeys";
export {
  getBudgetStatusConfig,
  getServiceRequestBudgetSheetMode,
  getServiceRequestBudgetSheetTitle,
  getServiceRequestBudgetActionLabel,
  type ServiceRequestBudgetSheetMode,
} from "./constants/serviceRequestBudgetSheet";
export {
  fetchServiceRequestBudgetCompareDetail,
  rejectServiceRequestBudgetProposal,
} from "./api/serviceRequestBudgetCompare.api";
export type {
  ServiceRequestBudgetCompareDetail,
  ServiceRequestBudgetCompareProposal,
} from "./types/serviceRequestBudgetCompare.types";
export { ReceivedBudgetDetailsSheet } from "./components/ReceivedBudgetDetailsSheet";
export { useServiceRequestBudgetCompareDetail } from "./hooks/useServiceRequestBudgetCompareDetail";
export { useProposalPhotoUrls } from "./hooks/useProposalPhotoUrls";
export {
  mapFormValuesToSuggestedSlots,
  maskBudgetInput,
  parseCurrencyInputToNumber,
} from "./utils/proposalComposerInput";
export { formatProposalSuggestedSlot } from "./utils/formatProposalSuggestedSlot";
export {
  PROPOSAL_REVISION_REASON_OPTIONS,
  getProposalRevisionReasonLabel,
} from "./utils/proposalRevisionReasonLabels";

export {
  getProposalResponseSlaHours,
  PROPOSAL_RESPONSE_SLA_KEY,
  DEFAULT_PROPOSAL_RESPONSE_SLA_HOURS,
} from "./api/platformConstants.api";
export { useProposalCountdown, type UseProposalCountdownParams } from "./hooks/useProposalCountdown";
export {
  ProposalCountdownBanner,
  type ProposalCountdownBannerProps,
} from "./components/ProposalCountdownBanner";
export type { ProposalDetailAudience, ProposalDetailView } from "./types/proposalDetails.types";
export type {
  ServiceRequestProposalDraft,
  ServiceRequestProposalSummary,
  ProviderLatestProposal,
  ProviderLatestProposalRow,
} from "./types/serviceRequestProposal.types";
export { mapLatestProviderProposalRow } from "./utils/mapLatestProviderProposalRow";
export {
  getProposalStatusLabel,
  formatProposalDateTime,
  formatProposalDateOnly,
  translateProposalShift,
} from "./utils/proposalDetailsFormatters";
export { mapProposalDetailToSummary } from "./utils/mapProposalDetailToSummary";
export {
  buildDateUnavailableRevisionInitialValues,
} from "./utils/buildDateUnavailableRevisionInitialValues";
export {
  normalizeProposalStatus,
  resolveProposalStatus,
  hasActiveServiceRequestProposal,
  canEditServiceRequestProposal,
  isRejectedProposalStatus,
  isPendingProposalStatus,
} from "./utils/proposalStatus";
export { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "./constants/proposalCopyVariants";
export {
  resolveClientProposalCtas,
  type ClientProposalCta,
} from "./utils/clientProposalCtas";
export {
  mockProviderCompletedServices,
  mockProviderRating,
} from "./utils/mockProviderRating";
export {
  computeProposalCountdown,
  formatProposalRemainingMs,
  resolveProposalExpiresAt,
  PROPOSAL_COUNTDOWN_WARNING_MS,
  type ProposalCountdownPhase,
  type ProposalCountdownSnapshot,
} from "./utils/proposalCountdown";
export {
  resolveProposalCountdownCopy,
  type ProposalCountdownAudience,
  type ProposalCountdownCopy,
} from "./utils/proposalCountdownCopy";
