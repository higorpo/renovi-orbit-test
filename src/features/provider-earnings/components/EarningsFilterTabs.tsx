import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SETTLEMENT_FILTER_TABS } from "../constants/filterTabs";
import type { SettlementFilterId } from "../types/settlements.types";

export type EarningsFilterTabsProps = {
  activeFilter: SettlementFilterId;
  onFilterChange: (filterId: SettlementFilterId) => void;
  disabled?: boolean;
};

export function EarningsFilterTabs({
  activeFilter,
  onFilterChange,
  disabled,
}: EarningsFilterTabsProps) {
  return (
    <Tabs
      value={activeFilter}
      onValueChange={(value) => onFilterChange(value as SettlementFilterId)}
    >
      <TabsList
        className={cn(
          "w-full justify-start gap-2 overflow-x-auto p-0",
          "bg-transparent min-h-0 rounded-none",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          "snap-x snap-mandatory scroll-smooth",
        )}
        role="tablist"
        aria-label="Filtros de ganhos"
      >
        {SETTLEMENT_FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => onFilterChange(tab.id)}
              disabled={disabled}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "rounded-full border border-muted-foreground/10 bg-transparent",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                "data-[state=active]:bg-muted data-[state=active]:border-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:shadow-none",
              )}
            >
              <span className="whitespace-nowrap">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
