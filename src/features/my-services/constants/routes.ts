export const ROUTE_MY_SERVICES_LIST = "/dashboard/services";
export const ROUTE_REQUEST_QUOTE = "/pedir-orcamento";
export const SERVICE_REQUEST_FOCUS_QUERY = "serviceRequestId";

/** @deprecated Use ROUTE_MY_SERVICES_LIST */
export const ROUTE_SERVICE_REQUESTS_LIST = ROUTE_MY_SERVICES_LIST;

export function getMyServicesPageUrlWithFocus(serviceRequestId: string): string {
  const params = new URLSearchParams();
  params.set(SERVICE_REQUEST_FOCUS_QUERY, serviceRequestId);
  return `${ROUTE_MY_SERVICES_LIST}?${params.toString()}`;
}

/** @deprecated Use getMyServicesPageUrlWithFocus */
export function getServiceRequestsPageUrlWithFocus(serviceRequestId: string): string {
  return getMyServicesPageUrlWithFocus(serviceRequestId);
}
