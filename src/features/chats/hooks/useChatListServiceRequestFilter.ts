import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { CHAT_SERVICE_REQUEST_FILTER_QUERY } from "../constants/routes";

export function useChatListServiceRequestFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const serviceRequestId = searchParams.get(CHAT_SERVICE_REQUEST_FILTER_QUERY);

  const clearFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(CHAT_SERVICE_REQUEST_FILTER_QUERY);
      return next;
    });
  }, [setSearchParams]);

  return {
    serviceRequestId,
    clearFilter,
  };
}
