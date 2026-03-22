import { useState, useCallback, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  BudgetsTab,
  BudgetStatusFilter,
  QuestionStatusFilter,
} from "../types/provider-budgets.types";

const SEARCH_DEBOUNCE_MS = 400;

export function useProviderBudgetsFilters() {
  const [activeTab, setActiveTab] = useState<BudgetsTab>("enviados");
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<BudgetStatusFilter>("all");
  const [questionStatusFilter, setQuestionStatusFilter] = useState<QuestionStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const resetFilters = useCallback(() => {
    setBudgetStatusFilter("all");
    setQuestionStatusFilter("all");
    setSearchQuery("");
  }, []);

  const budgetStatusParam = useMemo(
    () => (budgetStatusFilter === "all" ? null : budgetStatusFilter),
    [budgetStatusFilter],
  );

  const questionStatusParam = useMemo(
    () => (questionStatusFilter === "all" ? null : questionStatusFilter),
    [questionStatusFilter],
  );

  const searchParam = useMemo(
    () => (debouncedSearch.trim() || null),
    [debouncedSearch],
  );

  const hasActiveFilters = useMemo(
    () =>
      budgetStatusFilter !== "all" ||
      questionStatusFilter !== "all" ||
      searchQuery.trim().length > 0,
    [budgetStatusFilter, questionStatusFilter, searchQuery],
  );

  return {
    activeTab,
    setActiveTab,
    budgetStatusFilter,
    setBudgetStatusFilter,
    questionStatusFilter,
    setQuestionStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    budgetStatusParam,
    questionStatusParam,
    searchParam,
    hasActiveFilters,
  };
}
