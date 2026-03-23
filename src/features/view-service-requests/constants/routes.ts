/**
 * Routes used by the view-service-requests feature.
 */

/** Path to create a new service request (request quote flow). */
export const ROUTE_REQUEST_QUOTE = "/pedir-orcamento";

/** Dashboard list of the user's service requests ("Meus Serviços" / Solicitações). */
export const ROUTE_SERVICE_REQUESTS_LIST = "/dashboard/requests";

/** Query param to open the list filtered to a single service request. */
export const SERVICE_REQUEST_FOCUS_QUERY = "serviceRequestId";

/** Base path for dashboard service detail (id appended). */
export const ROUTE_SERVICE_DETAIL = "/dashboard/services";

export function getServiceDetailPath(id: string): string {
  return `${ROUTE_SERVICE_DETAIL}/${id}`;
}

/** URL for Meus Serviços with a deep link to one service request. */
export function getServiceRequestsPageUrlWithFocus(serviceRequestId: string): string {
  const params = new URLSearchParams();
  params.set(SERVICE_REQUEST_FOCUS_QUERY, serviceRequestId);
  return `${ROUTE_SERVICE_REQUESTS_LIST}?${params.toString()}`;
}
