export { ServiceDetailPage } from "./components/ServiceDetailPage";
export { ServiceDetailShell } from "./components/ServiceDetailShell";
export { ServiceDetailSheet } from "./components/ServiceDetailSheet";
export { SimpleServiceCard } from "./components/SimpleServiceCard";
export type { SimpleServiceCardProps } from "./components/SimpleServiceCard";
export { SimpleServiceCardSkeleton } from "./components/SimpleServiceCardSkeleton";
export type { SimpleServiceCardSkeletonProps } from "./components/SimpleServiceCardSkeleton";
export { ServiceDetailSkeleton } from "./components/ServiceDetailSkeleton";
export type { ServiceDetailSkeletonProps } from "./components/ServiceDetailSkeleton";

export {
  getServiceById,
  listServices,
  cancelService,
  republishCancelledServiceRequest,
  getClientServiceJourney,
} from "./api/services.api";
export type { RepublishCancelledServiceResult } from "./api/services.api";
export {
  recordProviderOpportunityView,
} from "./api/opportunityView.api";
export type { RecordProviderOpportunityViewResult } from "./api/opportunityView.api";
export { useServicesList } from "./hooks/useServicesList";
export { useService } from "./hooks/useService";
export { useClientServiceJourney } from "./hooks/useClientServiceJourney";
export type {
  UseClientServiceJourneyParams,
  UseClientServiceJourneyResult,
} from "./hooks/useClientServiceJourney";
export { useCancelService } from "./hooks/useCancelService";
export { useRepublishCancelledService } from "./hooks/useRepublishCancelledService";
export { useServiceDetailModal } from "./hooks/useServiceDetailModal";
export { useServiceRequestBudgetSheet } from "./hooks/useServiceRequestBudgetSheet";
export { useRecordProviderOpportunityView } from "./hooks/useRecordProviderOpportunityView";

export type {
  ServiceModel,
  ServiceListPhase,
  ListServicesParams,
  PaginatedServicesResult,
  AddressSummary,
  PlatformServiceSummary,
  ContractedServiceStatus,
  ContractedServiceSummary,
  ContractedProviderSummary,
} from "./types/service.types";
export type {
  ClientServiceJourney,
  PresentedServiceJourneyMilestone,
  ServiceJourneyMilestone,
  ServiceJourneyMilestoneKey,
  ServiceJourneyMilestoneStatus,
} from "./types/serviceJourney.types";

export {
  SERVICES_LIST_QUERY_KEY,
  SERVICE_DETAIL_QUERY_KEY,
  SERVICE_JOURNEY_QUERY_KEY,
} from "./constants/queryKeys";
export { ROUTE_SERVICE_DETAIL, getServiceDetailPath } from "./constants/routes";
export {
  createProviderJobsServiceDetailState,
  createProviderMyServicesServiceDetailState,
  createProviderEarningsServiceDetailState,
  createProviderCalendarServiceDetailState,
  createClientMyServicesServiceDetailState,
  type ServiceDetailLocationState,
  type ServiceDetailReturnTo,
  type MyServicesViewerRole,
} from "./types/serviceDetailNavigation.types";
export { getUrgencyConfig } from "./constants/serviceDetail.constants";
export {
  STATUS_TABS,
  DEFAULT_STATUS_TAB_ID,
  statusToTabId,
  statusTabIdToListPhase,
  tabIncludesStatus,
} from "./constants/statusTabs";
export type { StatusTabId } from "./constants/statusTabs";
export { getStatusLabel, getStatusBadgeVariant } from "./constants/statusBadge";
export type { StatusBadgeVariant } from "./constants/statusBadge";
export { isServiceDetailSheetLocation } from "./utils/isServiceDetailSheetLocation";
export { mapRpcServiceRow } from "./utils/serviceMapper";
export { getServiceCoordinates } from "./utils/serviceLocation";
export { formatLocationDisplay } from "./utils/locationDisplay";
export { formatDatePtBr as formatServiceDate } from "@/lib/utils/formatDate";
export {
  getServiceRequestBudgetActionIcon,
  getServiceRequestBudgetActionLabel,
  getServiceRequestBudgetActionState,
  getServiceRequestBudgetSheetMode,
  type ServiceRequestBudgetActionParams,
  type ServiceRequestBudgetSheetMode,
} from "./utils/serviceRequestBudgetAction";
export {
  formatScheduledSummary,
  formatScheduledSummaryLabel,
  getScheduleHighlightContent,
  getScheduledTiming,
} from "./utils/formatScheduledSummary";
export { getContractedServiceStatusLabel } from "./utils/contractedServiceStatusLabel";
export {
  getPendingPaymentHighlightContent,
  type PendingPaymentAudience,
  type PendingPaymentHighlightContent,
  type PendingPaymentHighlightEmphasis,
} from "./utils/pendingPaymentHighlight";
export {
  resolveClientCardActions,
  resolveClientPrimaryIntent,
  type ClientServiceActionIntent,
  type ClientServiceCardAction,
  type ClientServiceCardActions,
} from "./utils/resolveClientCardActions";
export {
  resolveProviderCardActions,
  resolveProviderPrimaryIntent,
  type ProviderServiceActionIntent,
  type ProviderServiceCardAction,
  type ProviderServiceCardActions,
} from "./utils/resolveProviderCardActions";
export {
  getClientServiceNextStep,
  getProviderServiceNextStep,
  getServiceNextStep,
  type ClientServiceNextStepIntent,
  type ProviderServiceNextStepIntent,
  type ServiceNextStep,
  type ServiceNextStepIcon,
  type ServiceNextStepIntent,
  type ServiceNextStepTrustFooter,
} from "./utils/serviceNextStep";
export { ServiceNextStepCard } from "./components/ServiceNextStepCard";
export type { ServiceNextStepCardProps } from "./components/ServiceNextStepCard";
export { ServiceJourneyCard } from "./components/ServiceJourneyCard";
export type { ServiceJourneyCardProps } from "./components/ServiceJourneyCard";
export { ServiceJourneyCardSkeleton } from "./components/ServiceJourneyCardSkeleton";
export type { ServiceJourneyCardSkeletonProps } from "./components/ServiceJourneyCardSkeleton";
export { ClientServiceJourneySection } from "./components/ClientServiceJourneySection";
export type { ClientServiceJourneySectionProps } from "./components/ClientServiceJourneySection";
export { ServiceSupportHelpCard } from "./components/ServiceSupportHelpCard";
export type { ServiceSupportHelpCardProps } from "./components/ServiceSupportHelpCard";
export {
  SERVICE_SUPPORT_URL,
  SERVICE_SUPPORT_HELP_TITLE,
  SERVICE_SUPPORT_HELP_DESCRIPTION,
  SERVICE_SUPPORT_HELP_CTA,
} from "./constants/serviceSupport.constants";
export { useServiceDetailNextStep } from "./hooks/useServiceDetailNextStep";
export type {
  UseServiceDetailNextStepParams,
  UseServiceDetailNextStepResult,
} from "./hooks/useServiceDetailNextStep";
export { SERVICE_PROVIDER_PROPOSAL_SECTION_ID } from "./constants/serviceDetailNextStep.constants";
export {
  presentServiceJourneyMilestones,
  formatJourneyOccurredAt,
} from "./utils/presentServiceJourney";
export { SERVICE_JOURNEY_CARD_TITLE } from "./constants/serviceJourney.constants";
