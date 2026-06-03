import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ReceivedStatusFilter } from "../types/client-budgets.types";

const SEARCH_DEBOUNCE_MS = 400;

export function useClientBudgetsFilters() {
  const [receivedStatusFilter, setReceivedStatusFilter] = useState<ReceivedStatusFilter>("awaiting_decision");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const resetFilters = useCallback(() => {
    setReceivedStatusFilter("awaiting_decision");
    setSearchQuery("");
  }, []);

  const receivedStatusParam = useMemo(() => receivedStatusFilter, [receivedStatusFilter]);
  const searchParam = useMemo(() => debouncedSearch.trim() || null, [debouncedSearch]);
  const hasActiveFilters = useMemo(
    () => receivedStatusFilter !== "awaiting_decision" || Boolean(searchQuery.trim()),
    [receivedStatusFilter, searchQuery],
  );

  return {
    receivedStatusFilter,
    setReceivedStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    receivedStatusParam,
    searchParam,
    hasActiveFilters,
  };
}
