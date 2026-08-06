/**
 * Service completion — Public API (decision 24 / design §5.7).
 *
 * External features (view-services) MUST import only from this barrel.
 * Export surface is curated for host composition — not a dump of api/hooks/utils.
 * Inside this feature, import from relative modules (api/, hooks/, …), not from here.
 */

// --- Host composition (view-services) ---
export { EnrichmentProcessingBanner } from "./components/EnrichmentProcessingBanner";
export type { EnrichmentProcessingBannerProps } from "./components/EnrichmentProcessingBanner";

export { ProviderMarkExecutedAction } from "./components/ProviderMarkExecutedAction";
export type { ProviderMarkExecutedActionProps } from "./components/ProviderMarkExecutedAction";

export { ProviderMarkExecutedSheet } from "./components/ProviderMarkExecutedSheet";
export type { ProviderMarkExecutedSheetProps } from "./components/ProviderMarkExecutedSheet";

export { ClientEvaluateServiceAction } from "./components/ClientEvaluateServiceAction";
export type { ClientEvaluateServiceActionProps } from "./components/ClientEvaluateServiceAction";

export { ProviderExecutedWizard } from "./components/ProviderExecutedWizard";
export type { ProviderExecutedWizardProps } from "./components/ProviderExecutedWizard";

export { ClientConfirmRatingWizard } from "./components/ClientConfirmRatingWizard";
export type { ClientConfirmRatingWizardProps } from "./components/ClientConfirmRatingWizard";

export { useServiceCompletionContext } from "./hooks/useServiceCompletionContext";
export type { UseServiceCompletionContextOptions } from "./hooks/useServiceCompletionContext";

export { deriveEnrichmentProcessingUi } from "./utils/enrichmentProcessing";
export type {
  EnrichmentProcessingKind,
  EnrichmentProcessingUi,
  DeriveEnrichmentProcessingInput,
} from "./utils/enrichmentProcessing";

// Types needed to type host props / projections
export type {
  EnrichmentStatus,
  ServiceCompletionContext,
} from "./types/completion.types";
