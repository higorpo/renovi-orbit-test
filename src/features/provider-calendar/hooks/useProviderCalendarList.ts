import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchProviderScheduledServices } from "../api/providerCalendar.api";
import { LIST_CHUNK_DAYS } from "../constants/calendar.constants";
import { PROVIDER_CALENDAR_LIST_QUERY_KEY } from "../constants/queryKeys";
import type { CalendarDayEntry } from "../types/provider-calendar.types";
import { addDaysIso, todayIso } from "../utils/calendarDateUtils";
import { getInitialListRange, groupServicesByDay, mergeScheduledItems } from "../utils/groupServicesByDay";

interface ListPageParam {
  from: string;
  to: string;
}

function buildForwardPage(lastTo: string): ListPageParam {
  const from = addDaysIso(lastTo, 1);
  return { from, to: addDaysIso(from, LIST_CHUNK_DAYS - 1) };
}

function buildBackwardPage(firstFrom: string): ListPageParam {
  const to = addDaysIso(firstFrom, -1);
  return { from: addDaysIso(to, -(LIST_CHUNK_DAYS - 1)), to };
}

function getScrollRoot(node: HTMLElement): Element | null {
  const main = node.closest("main");
  return main instanceof HTMLElement ? main : null;
}

export function useProviderCalendarList(enabled: boolean) {
  const today = todayIso();
  const initialRange = useMemo(() => getInitialListRange(today), [today]);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const query = useInfiniteQuery({
    queryKey: [PROVIDER_CALENDAR_LIST_QUERY_KEY],
    enabled,
    initialPageParam: initialRange satisfies ListPageParam,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchProviderScheduledServices(
        pageParam.from,
        pageParam.to,
      );
      if (error || !data) throw error ?? new Error("Failed to load calendar list");
      return data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMoreAfter) return undefined;
      return buildForwardPage(lastPage.rangeTo);
    },
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.hasMoreBefore) return undefined;
      return buildBackwardPage(firstPage.rangeFrom);
    },
  });

  const services = useMemo(
    () =>
      mergeScheduledItems(
        [],
        query.data?.pages.flatMap((page) => page.items) ?? [],
      ),
    [query.data?.pages],
  );

  const rangeBounds = useMemo(() => {
    const pages = query.data?.pages ?? [];
    if (pages.length === 0) return initialRange;
    const from = pages.reduce(
      (min, page) => (page.rangeFrom < min ? page.rangeFrom : min),
      pages[0].rangeFrom,
    );
    const to = pages.reduce(
      (max, page) => (page.rangeTo > max ? page.rangeTo : max),
      pages[0].rangeTo,
    );
    return { from, to };
  }, [initialRange, query.data?.pages]);

  const days = useMemo<CalendarDayEntry[]>(
    () => groupServicesByDay(rangeBounds.from, rangeBounds.to, services),
    [rangeBounds.from, rangeBounds.to, services],
  );

  const hasMoreBefore = query.data?.pages[0]?.hasMoreBefore ?? true;
  const hasMoreAfter = query.data?.pages.at(-1)?.hasMoreAfter ?? true;

  const loadNextPage = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query]);

  const loadPreviousPage = useCallback(() => {
    if (query.hasPreviousPage && !query.isFetchingPreviousPage) {
      void query.fetchPreviousPage();
    }
  }, [query]);

  useEffect(() => {
    if (!enabled) return undefined;

    const node = bottomSentinelRef.current;
    if (!node || !hasMoreAfter) return undefined;

    const root = getScrollRoot(node);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { root, rootMargin: "320px 0px 0px 0px", threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, hasMoreAfter, loadNextPage]);

  useEffect(() => {
    if (!enabled) return undefined;

    const node = topSentinelRef.current;
    if (!node || !hasMoreBefore) return undefined;

    const root = getScrollRoot(node);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadPreviousPage();
      },
      { root, rootMargin: "320px 0px 0px 0px", threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, hasMoreBefore, loadPreviousPage]);

  return {
    days,
    today,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoadingBackward: query.isFetchingPreviousPage,
    isError: query.isError,
    refetch: query.refetch,
    topSentinelRef,
    bottomSentinelRef,
  };
}

export type UseProviderCalendarListResult = ReturnType<typeof useProviderCalendarList>;
