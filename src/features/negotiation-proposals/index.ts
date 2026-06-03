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
  acceptProposal,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
  getProposalDetail,
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
  ProposalSuggestedSlotShift,
  ProposalSuggestedSlotRpc,
  ProposalVersionListResponse,
  AcceptProposalResult,
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
  ServiceRequestProposalComposerDialog,
  type ServiceRequestProposalComposerDialogProps,
} from "./components/ServiceRequestProposalComposerDialog";
export {
  ProposalDetailsDialog,
  type ProposalDetailsDialogProps,
  type ProposalDetailsContent,
} from "./components/ProposalDetailsDialog";
export {
  ServiceRequestProposalSummaryCard,
  type ServiceRequestProposalSummaryCardProps,
} from "./components/ServiceRequestProposalSummaryCard";
export {
  ProposalHistoryAccordion,
} from "./components/ProposalHistoryAccordion";
export { ProposalPhotosGrid } from "./components/ProposalPhotosGrid";
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
export { PROPOSAL_DETAIL_QUERY_KEY, PROPOSAL_HISTORY_QUERY_KEY } from "./constants/queryKeys";
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
export type { ProposalDetailAudience, ProposalDetailView } from "./types/proposalDetails.types";
export type {
  ServiceRequestProposalDraft,
  ServiceRequestProposalSummary,
} from "./types/serviceRequestProposal.types";
export {
  getProposalStatusLabel,
  formatProposalDateTime,
  formatProposalDateOnly,
  translateProposalShift,
} from "./utils/proposalDetailsFormatters";
export { mapProposalDetailToSummary } from "./utils/mapProposalDetailToSummary";
export {
  normalizeProposalStatus,
  hasActiveServiceRequestProposal,
  canEditServiceRequestProposal,
  isRejectedProposalStatus,
  isPendingProposalStatus,
} from "./utils/proposalStatus";
export { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "./constants/proposalCopyVariants";
export {
  computeProposalCountdown,
  formatProposalRemainingMs,
  resolveProposalExpiresAt,
  PROPOSAL_COUNTDOWN_WARNING_MS,
  type ProposalCountdownPhase,
  type ProposalCountdownSnapshot,
} from "./utils/proposalCountdown";
