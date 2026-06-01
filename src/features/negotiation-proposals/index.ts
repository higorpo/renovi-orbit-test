/**
 * Negotiation proposals feature — Public API (design §13.9).
 *
 * Proposal composer and accept/reject flows live here (extracted from provider-jobs in task 97).
 * Do not import from api/, hooks/, components/, or types/ paths directly.
 */

export { CNS_PROPOSAL_RPC, type CnsProposalRpcName } from "./api/proposals.rpc";
export {
  proposalsApi,
  submitProposal,
  acceptProposal,
  rejectProposal,
  requestProposalRevision,
  declineRevisionRequest,
  listProposalVersions,
} from "./api/proposals.api";

export type {
  ProposalStatus,
  ProposalRevisionReason,
  ProviderProposalRow,
  ProposalSuggestedSlotShift,
  ProposalSuggestedSlotRpc,
  ProposalPricingInput,
  ProposalVersionListItem,
  ProposalVersionListResponse,
  SubmitProposalResult,
  SubmitProposalResultProposal,
  SubmitProposalResultTimelineMessage,
  AcceptProposalResult,
  AcceptProposalResultService,
  AcceptProposalResultProposal,
  ProposalMutationResult,
  ProposalBusinessErrorCode,
  ProposalsApiError,
  ProposalsApiResult,
} from "./types/proposals.types";

export { mapProposalRpcError } from "./utils/proposalApiErrors";

export {
  MAX_PROPOSAL_DESCRIPTION_LENGTH,
  MAX_PROPOSAL_PHOTOS,
  PROPOSAL_PRICING_DEBOUNCE_MS,
} from "./constants/proposalComposer";
export {
  ProposalComposer,
  isProposalComposerFormValid,
  type ProposalComposerProps,
} from "./components/ProposalComposer";
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
  computeProposalCountdown,
  formatProposalRemainingMs,
  resolveProposalExpiresAt,
  PROPOSAL_COUNTDOWN_WARNING_MS,
  type ProposalCountdownPhase,
  type ProposalCountdownSnapshot,
} from "./utils/proposalCountdown";
