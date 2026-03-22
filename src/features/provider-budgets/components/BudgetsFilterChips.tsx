import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { BudgetsTab, BudgetStatusFilter, QuestionStatusFilter } from "../types/provider-budgets.types";
import { BUDGET_STATUS_FILTERS, QUESTION_STATUS_FILTERS } from "../constants/budgetStatus";

export interface BudgetsFilterChipsProps {
  activeTab: BudgetsTab;
  budgetStatusFilter: BudgetStatusFilter;
  questionStatusFilter: QuestionStatusFilter;
  searchQuery: string;
  onBudgetStatusChange: (filter: BudgetStatusFilter) => void;
  onQuestionStatusChange: (filter: QuestionStatusFilter) => void;
  onSearchChange: (query: string) => void;
  disabled?: boolean;
}

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
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {label}
    </button>
  );
}

export function BudgetsFilterChips({
  activeTab,
  budgetStatusFilter,
  questionStatusFilter,
  searchQuery,
  onBudgetStatusChange,
  onQuestionStatusChange,
  onSearchChange,
  disabled,
}: BudgetsFilterChipsProps) {
  const filters =
    activeTab === "enviados" ? BUDGET_STATUS_FILTERS : QUESTION_STATUS_FILTERS;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        className={cn(
          "flex items-center gap-2 overflow-x-auto",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          "snap-x snap-mandatory scroll-smooth",
        )}
        role="tablist"
        aria-label="Filtros de status"
      >
        {filters.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            isActive={
              activeTab === "enviados"
                ? budgetStatusFilter === f.id
                : questionStatusFilter === f.id
            }
            onClick={() => {
              if (activeTab === "enviados") {
                onBudgetStatusChange(f.id as BudgetStatusFilter);
              } else {
                onQuestionStatusChange(f.id as QuestionStatusFilter);
              }
            }}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
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
