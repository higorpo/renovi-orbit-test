export const ROUTE_SERVICE_DETAIL = "/dashboard/services";

export function getServiceDetailPath(id: string): string {
  return `${ROUTE_SERVICE_DETAIL}/${id}`;
}
