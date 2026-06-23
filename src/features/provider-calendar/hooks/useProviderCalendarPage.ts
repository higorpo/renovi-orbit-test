import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  createProviderCalendarServiceDetailState,
  getServiceDetailPath,
} from "@/features/view-services";
import type { ScheduledServiceItem } from "../types/provider-calendar.types";
import { useProviderCalendarList } from "./useProviderCalendarList";
import { useProviderCalendarMonth } from "./useProviderCalendarMonth";
import { useProviderCalendarViewMode } from "./useProviderCalendarViewMode";

export function useProviderCalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { viewMode } = useProviderCalendarViewMode();
  const isListView = viewMode === "list";
  const list = useProviderCalendarList(isListView);
  const month = useProviderCalendarMonth(!isListView);

  const handleOpenService = useCallback(
    (service: ScheduledServiceItem) => {
      navigate(getServiceDetailPath(service.serviceRequestId), {
        state: createProviderCalendarServiceDetailState(location),
      });
    },
    [location, navigate],
  );

  const isLoading = isListView ? list.isLoading : month.isLoading;
  const isError = isListView ? list.isError : month.isError;
  const refetch = isListView ? list.refetch : month.refetch;

  return {
    viewMode,
    list,
    month,
    handleOpenService,
    isLoading,
    isError,
    refetch,
  };
}

export type UseProviderCalendarPageResult = ReturnType<typeof useProviderCalendarPage>;
