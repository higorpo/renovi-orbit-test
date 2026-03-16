/**
 * Routes used by the view-service-requests feature.
 */

/** Path to create a new service request (request quote flow). */
export const ROUTE_REQUEST_QUOTE = "/pedir-orcamento";

/** Base path for dashboard service detail (id appended). */
export const ROUTE_SERVICE_DETAIL = "/dashboard/services";

export function getServiceDetailPath(id: string): string {
  return `${ROUTE_SERVICE_DETAIL}/${id}`;
}
