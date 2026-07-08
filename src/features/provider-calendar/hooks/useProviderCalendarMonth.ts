import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchProviderScheduledServices } from "../api/providerCalendar.api";
import { PROVIDER_CALENDAR_MONTH_QUERY_KEY } from "../constants/queryKeys";
import type { ScheduledServiceItem } from "../types/provider-calendar.types";
import {
  getMonthEndIso,
  getMonthStartIso,
  todayCalendarIso,
} from "@/lib/utils/calendarDate";
import { getMonthGridWeeks, getMonthYearLabel } from "../utils/calendarDateUtils";

function getInitialMonth(): { year: number; monthIndex: number } {
  const today = todayCalendarIso();
  const year = Number(today.slice(0, 4));
  const monthIndex = Number(today.slice(5, 7)) - 1;
  return { year, monthIndex };
}

export function useProviderCalendarMonth(enabled: boolean) {
  const initial = useMemo(() => getInitialMonth(), []);
  const [year, setYear] = useState(initial.year);
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);

  const rangeFrom = getMonthStartIso(year, monthIndex);
  const rangeTo = getMonthEndIso(year, monthIndex);

  const query = useQuery({
    queryKey: [PROVIDER_CALENDAR_MONTH_QUERY_KEY, year, monthIndex],
    enabled,
    queryFn: async () => {
      const { data, error } = await fetchProviderScheduledServices(rangeFrom, rangeTo);
      if (error || !data) throw error ?? new Error("Failed to load calendar month");
      return data;
    },
  });

  const services = query.data?.items ?? [];
  const weeks = useMemo(() => getMonthGridWeeks(year, monthIndex), [year, monthIndex]);
  const monthLabel = getMonthYearLabel(year, monthIndex);

  const goToPreviousMonth = () => {
    if (monthIndex === 0) {
      setYear((value) => value - 1);
      setMonthIndex(11);
      return;
    }
    setMonthIndex((value) => value - 1);
  };

  const goToNextMonth = () => {
    if (monthIndex === 11) {
      setYear((value) => value + 1);
      setMonthIndex(0);
      return;
    }
    setMonthIndex((value) => value + 1);
  };

  const goToToday = () => {
    const today = getInitialMonth();
    setYear(today.year);
    setMonthIndex(today.monthIndex);
  };

  return {
    year,
    monthIndex,
    monthLabel,
    weeks,
    services: services as ScheduledServiceItem[],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
  };
}

export type UseProviderCalendarMonthResult = ReturnType<typeof useProviderCalendarMonth>;
