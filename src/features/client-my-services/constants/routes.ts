export const ROUTE_REQUEST_QUOTE = "/pedir-orcamento";
export const ROUTE_SERVICE_REQUESTS_LIST = "/dashboard/requests";
export const SERVICE_REQUEST_FOCUS_QUERY = "serviceRequestId";

export function getServiceRequestsPageUrlWithFocus(serviceRequestId: string): string {
  const params = new URLSearchParams();
  params.set(SERVICE_REQUEST_FOCUS_QUERY, serviceRequestId);
  return `${ROUTE_SERVICE_REQUESTS_LIST}?${params.toString()}`;
}
