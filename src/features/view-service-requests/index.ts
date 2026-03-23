/**
 * View-service-requests feature — Public API.
 * Entrypoint for dashboard "Meus Serviços" and service detail.
 */

export { ServiceRequestsPage } from "./components/ServiceRequestsPage";
export { ServiceDetailPlaceholder } from "./components/ServiceDetailPlaceholder";
export {
  getServiceRequestsPageUrlWithFocus,
  SERVICE_REQUEST_FOCUS_QUERY,
  ROUTE_SERVICE_REQUESTS_LIST,
} from "./constants/routes";
