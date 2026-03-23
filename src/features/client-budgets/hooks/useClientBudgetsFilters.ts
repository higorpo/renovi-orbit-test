import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type {
  ClientBudgetsTab,
  QuestionStatusFilter,
  ReceivedStatusFilter,
} from "../types/client-budgets.types";

const SEARCH_DEBOUNCE_MS = 400;

export function useClientBudgetsFilters() {
  const [activeTab, setActiveTab] = useState<ClientBudgetsTab>("recebidos");
  const [receivedStatusFilter, setReceivedStatusFilter] = useState<ReceivedStatusFilter>("awaiting_decision");
  const [questionStatusFilter, setQuestionStatusFilter] = useState<QuestionStatusFilter>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const resetFilters = useCallback(() => {
    setReceivedStatusFilter("awaiting_decision");
    setQuestionStatusFilter("pending");
    setSearchQuery("");
  }, []);

  const receivedStatusParam = useMemo(() => receivedStatusFilter, [receivedStatusFilter]);
  const questionStatusParam = useMemo(() => questionStatusFilter, [questionStatusFilter]);
  const searchParam = useMemo(() => debouncedSearch.trim() || null, [debouncedSearch]);
  const hasActiveFilters = useMemo(
    () =>
      receivedStatusFilter !== "awaiting_decision" ||
      questionStatusFilter !== "pending" ||
      Boolean(searchQuery.trim()),
    [receivedStatusFilter, questionStatusFilter, searchQuery],
  );

  return {
    activeTab,
    setActiveTab,
    receivedStatusFilter,
    setReceivedStatusFilter,
    questionStatusFilter,
    setQuestionStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    receivedStatusParam,
    questionStatusParam,
    searchParam,
    hasActiveFilters,
  };
}
