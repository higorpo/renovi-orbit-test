export { ServiceDetailPage } from "./components/ServiceDetailPage";
export { ServiceCompletionActions } from "./components/ServiceCompletionActions";
export type {
  ServiceCompletionActionsProps,
  ServiceCompletionViewerRole,
} from "./components/ServiceCompletionActions";
export { ServiceDetailShell } from "./components/ServiceDetailShell";
export { ServiceDetailSheet } from "./components/ServiceDetailSheet";
export { SimpleServiceCard } from "./components/SimpleServiceCard";
export type { SimpleServiceCardProps } from "./components/SimpleServiceCard";
export { SimpleServiceCardSkeleton } from "./components/SimpleServiceCardSkeleton";
export type { SimpleServiceCardSkeletonProps } from "./components/SimpleServiceCardSkeleton";
export { ServiceDetailSkeleton } from "./components/ServiceDetailSkeleton";
export type { ServiceDetailSkeletonProps } from "./components/ServiceDetailSkeleton";

export { getServiceById, listServices, cancelService } from "./api/services.api";
export {
  markServiceExecuted,
} from "./api/markServiceExecuted.api";
export type { MarkServiceExecutedSuccess } from "./api/markServiceExecuted.api";
export {
  confirmServiceCompleted,
} from "./api/confirmServiceCompleted.api";
export type { ConfirmServiceCompletedSuccess } from "./api/confirmServiceCompleted.api";
export {
  recordProviderOpportunityView,
} from "./api/opportunityView.api";
export type { RecordProviderOpportunityViewResult } from "./api/opportunityView.api";
export { useServicesList } from "./hooks/useServicesList";
export { useService } from "./hooks/useService";
export { useCancelService } from "./hooks/useCancelService";
export { useMarkServiceExecuted } from "./hooks/useMarkServiceExecuted";
export { useConfirmServiceCompleted } from "./hooks/useConfirmServiceCompleted";
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
} from "./types/service.types";

export {
  SERVICES_LIST_QUERY_KEY,
  SERVICE_DETAIL_QUERY_KEY,
} from "./constants/queryKeys";
export { ROUTE_SERVICE_DETAIL, getServiceDetailPath } from "./constants/routes";
export {
  createProviderJobsServiceDetailState,
  createProviderMyServicesServiceDetailState,
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
