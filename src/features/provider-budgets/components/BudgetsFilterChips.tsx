import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { BudgetStatusFilter } from "../types/provider-budgets.types";
import { BUDGET_STATUS_FILTERS } from "../constants/budgetStatus";

export interface BudgetsFilterChipsProps {
  budgetStatusFilter: BudgetStatusFilter;
  searchQuery: string;
  onBudgetStatusChange: (filter: BudgetStatusFilter) => void;
  onSearchChange: (query: string) => void;
  disabled?: boolean;
}

export function BudgetsFilterChips({
  budgetStatusFilter,
  searchQuery,
  onBudgetStatusChange,
  onSearchChange,
  disabled,
}: BudgetsFilterChipsProps) {
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
        {BUDGET_STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            icon={f.icon}
            iconColor={f.iconColor}
            isActive={budgetStatusFilter === f.id}
            onClick={() => onBudgetStatusChange(f.id)}
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
