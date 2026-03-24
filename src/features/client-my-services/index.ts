/**
 * Client My Services feature — Public API.
 * Entrypoint for dashboard "Meus Serviços" and service detail.
 */

export { ClientMyServicesPage } from "./components/ClientMyServicesPage";
export { ClientMyServicesDetailPlaceholder } from "./components/ClientMyServicesDetailPlaceholder";
export {
  getServiceRequestsPageUrlWithFocus,
  SERVICE_REQUEST_FOCUS_QUERY,
  ROUTE_SERVICE_REQUESTS_LIST,
} from "./constants/routes";
