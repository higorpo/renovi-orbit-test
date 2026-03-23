import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { QUESTION_FILTERS, RECEIVED_FILTERS } from "../constants/status";
import type { ClientBudgetsTab, QuestionStatusFilter, ReceivedStatusFilter } from "../types/client-budgets.types";

function FilterChip({
  label,
  isActive,
  onClick,
  disabled,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors sm:h-9 sm:px-4 sm:text-sm",
        "whitespace-nowrap snap-start",
        isActive
          ? "border-muted-foreground/60 bg-muted text-foreground"
          : "border-muted-foreground/10 bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por serviço, local ou prestador"
          className="h-9 pl-9 text-sm"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
