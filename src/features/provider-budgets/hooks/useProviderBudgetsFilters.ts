import { useState, useCallback, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_BUDGET_STATUS_FILTER,
  type BudgetStatusFilter,
} from "../types/provider-budgets.types";

const SEARCH_DEBOUNCE_MS = 400;

export function useProviderBudgetsFilters() {
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<BudgetStatusFilter>(
    DEFAULT_BUDGET_STATUS_FILTER,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const resetFilters = useCallback(() => {
    setBudgetStatusFilter(DEFAULT_BUDGET_STATUS_FILTER);
    setSearchQuery("");
  }, []);

  const budgetStatusParam = useMemo(() => budgetStatusFilter, [budgetStatusFilter]);

  const searchParam = useMemo(
    () => (debouncedSearch.trim() || null),
    [debouncedSearch],
  );

  const hasActiveFilters = useMemo(
    () =>
      budgetStatusFilter !== DEFAULT_BUDGET_STATUS_FILTER ||
      searchQuery.trim().length > 0,
    [budgetStatusFilter, searchQuery],
  );

  return {
    budgetStatusFilter,
    setBudgetStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    budgetStatusParam,
    searchParam,
    hasActiveFilters,
  };
}
