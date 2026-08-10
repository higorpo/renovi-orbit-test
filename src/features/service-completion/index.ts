/**
 * Service completion — Public API (decision 24 / design §5.7).
 *
 * External features (view-services) MUST import only from this barrel.
 * Export surface is curated for host composition — not a dump of api/hooks/utils.
 * Inside this feature, import from relative modules (api/, hooks/, …), not from here.
 */

// --- Host composition (view-services) ---
export { ProviderMarkExecutedAction } from "./components/ProviderMarkExecutedAction";
export type { ProviderMarkExecutedActionProps } from "./components/ProviderMarkExecutedAction";

export { ProviderMarkExecutedSheet } from "./components/ProviderMarkExecutedSheet";
export type { ProviderMarkExecutedSheetProps } from "./components/ProviderMarkExecutedSheet";

export { ClientEvaluateServiceAction } from "./components/ClientEvaluateServiceAction";
export type { ClientEvaluateServiceActionProps } from "./components/ClientEvaluateServiceAction";

export { ClientEvaluateServiceSheet } from "./components/ClientEvaluateServiceSheet";
export type { ClientEvaluateServiceSheetProps } from "./components/ClientEvaluateServiceSheet";

export { ClientEvaluateSuccessStep } from "./components/ClientEvaluateSuccessStep";
export type {
  ClientEvaluateSuccessStepProps,
  ClientEvaluateSuccessMode,
} from "./components/ClientEvaluateSuccessStep";

export { PendingEvaluationPromptHost } from "./components/PendingEvaluationPromptHost";

export { ProviderExecutedWizard } from "./components/ProviderExecutedWizard";
export type { ProviderExecutedWizardProps } from "./components/ProviderExecutedWizard";

export { CompletionSuccessStep } from "./components/CompletionSuccessStep";
export type {
  CompletionSuccessStepProps,
  CompletionSuccessTip,
} from "./components/CompletionSuccessStep";

export { ProviderExecutedSuccessStep } from "./components/ProviderExecutedSuccessStep";
export type { ProviderExecutedSuccessStepProps } from "./components/ProviderExecutedSuccessStep";

export { ClientConfirmRatingWizard } from "./components/ClientConfirmRatingWizard";
export type { ClientConfirmRatingWizardProps } from "./components/ClientConfirmRatingWizard";

export { OpenDisputeEntry, shouldShowOpenDispute } from "./components/OpenDisputeEntry";
export type { OpenDisputeEntryProps } from "./components/OpenDisputeEntry";

export { OpenDisputeConfirmDialog } from "./components/OpenDisputeConfirmDialog";
export type { OpenDisputeConfirmDialogProps } from "./components/OpenDisputeConfirmDialog";

export { useOpenDispute } from "./hooks/useOpenDispute";
export type {
  UseOpenDisputeOptions,
  OpenDisputeMutationInput,
} from "./hooks/useOpenDispute";
export {
  DISPUTE_OPENED_ANALYTICS_EVENT,
  DISPUTE_OPEN_FAILED_ANALYTICS_EVENT,
} from "./hooks/useOpenDispute";

export { openDispute } from "./api/lifecycle.api";
export type {
  OpenDisputeInput,
  OpenDisputeSuccess,
  OpenDisputeResult,
} from "./api/lifecycle.api";

export { useServiceCompletionContext } from "./hooks/useServiceCompletionContext";
export type { UseServiceCompletionContextOptions } from "./hooks/useServiceCompletionContext";

// Types needed to type host props / projections
export type {
  EnrichmentStatus,
  ServiceCompletionContext,
  ServiceCompletionCapabilities,
} from "./types/completion.types";
