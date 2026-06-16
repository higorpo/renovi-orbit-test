export const ROUTE_CHATS_LIST = "/dashboard/chats";
export const CHAT_SERVICE_REQUEST_FILTER_QUERY = "serviceRequestId";

export function getChatsPageUrlWithServiceRequestFilter(serviceRequestId: string): string {
  const params = new URLSearchParams();
  params.set(CHAT_SERVICE_REQUEST_FILTER_QUERY, serviceRequestId);
  return `${ROUTE_CHATS_LIST}?${params.toString()}`;
}
