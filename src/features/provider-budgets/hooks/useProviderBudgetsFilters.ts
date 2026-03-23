import { useState, useCallback, useMemo } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  DEFAULT_BUDGET_STATUS_FILTER,
  DEFAULT_QUESTION_STATUS_FILTER,
  type BudgetsTab,
  type BudgetStatusFilter,
  type QuestionStatusFilter,
} from "../types/provider-budgets.types";

const SEARCH_DEBOUNCE_MS = 400;

export function useProviderBudgetsFilters() {
  const [activeTab, setActiveTab] = useState<BudgetsTab>("enviados");
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<BudgetStatusFilter>(
    DEFAULT_BUDGET_STATUS_FILTER,
  );
  const [questionStatusFilter, setQuestionStatusFilter] = useState<QuestionStatusFilter>(
    DEFAULT_QUESTION_STATUS_FILTER,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const resetFilters = useCallback(() => {
    setBudgetStatusFilter(DEFAULT_BUDGET_STATUS_FILTER);
    setQuestionStatusFilter(DEFAULT_QUESTION_STATUS_FILTER);
    setSearchQuery("");
  }, []);

  const budgetStatusParam = useMemo(() => budgetStatusFilter, [budgetStatusFilter]);

  const questionStatusParam = useMemo(() => questionStatusFilter, [questionStatusFilter]);

  const searchParam = useMemo(
    () => (debouncedSearch.trim() || null),
    [debouncedSearch],
  );

  const hasActiveFilters = useMemo(
    () =>
      budgetStatusFilter !== DEFAULT_BUDGET_STATUS_FILTER ||
      questionStatusFilter !== DEFAULT_QUESTION_STATUS_FILTER ||
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
