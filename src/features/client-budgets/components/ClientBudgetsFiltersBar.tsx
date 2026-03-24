import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/ui/filter-chip";
import { cn } from "@/lib/utils";
import { QUESTION_FILTERS, RECEIVED_FILTERS } from "../constants/status";
import type { ClientBudgetsTab, QuestionStatusFilter, ReceivedStatusFilter } from "../types/client-budgets.types";

interface ClientBudgetsFiltersBarProps {
  activeTab: ClientBudgetsTab;
  receivedStatusFilter: ReceivedStatusFilter;
  questionStatusFilter: QuestionStatusFilter;
  searchQuery: string;
  onReceivedStatusChange: (filter: ReceivedStatusFilter) => void;
  onQuestionStatusChange: (filter: QuestionStatusFilter) => void;
  onSearchChange: (value: string) => void;
  disabled?: boolean;
}

export function ClientBudgetsFiltersBar({
  activeTab,
  receivedStatusFilter,
  questionStatusFilter,
  searchQuery,
  onReceivedStatusChange,
  onQuestionStatusChange,
  onSearchChange,
  disabled,
}: ClientBudgetsFiltersBarProps) {
  const filters = activeTab === "recebidos" ? RECEIVED_FILTERS : QUESTION_FILTERS;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          "snap-x snap-mandatory scroll-smooth",
        )}
      >
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            icon={filter.icon}
            iconColor={filter.iconColor}
            isActive={
              activeTab === "recebidos"
                ? receivedStatusFilter === filter.id
                : questionStatusFilter === filter.id
            }
            onClick={() =>
              activeTab === "recebidos"
                ? onReceivedStatusChange(filter.id as ReceivedStatusFilter)
                : onQuestionStatusChange(filter.id as QuestionStatusFilter)
            }
            disabled={disabled}
          />
        ))}
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9 text-sm"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
