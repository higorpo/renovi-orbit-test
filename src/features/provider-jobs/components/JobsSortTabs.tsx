import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getVisibleSortModes } from "../constants/sortModes";
import type { SortMode } from "../types/provider-jobs.types";

export interface JobsSortTabsProps {
  activeMode: SortMode;
  onModeChange: (mode: SortMode) => void;
  disabled?: boolean;
  /** When false, nearest sort is hidden (ADR 0002, Req 13.4). */
  hasFeedGps?: boolean;
}

export function JobsSortTabs({
  activeMode,
  onModeChange,
  disabled,
  hasFeedGps = false,
}: JobsSortTabsProps) {
  const visibleModes = getVisibleSortModes(hasFeedGps);

  return (
    <Tabs
      value={activeMode}
      onValueChange={(v) => onModeChange(v as SortMode)}
    >
      <TabsList
        className={cn(
          "w-full justify-start gap-2 overflow-x-auto p-0",
          "bg-transparent min-h-0 rounded-none",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          "snap-x snap-mandatory scroll-smooth",
        )}
        role="tablist"
        aria-label="Ordenação dos trabalhos"
      >
        {visibleModes.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <TabsTrigger
              key={mode.id}
              value={mode.id}
              onClick={() => onModeChange(mode.id)}
              disabled={disabled}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "gap-1.5 rounded-full border border-muted-foreground/10 bg-transparent",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                "data-[state=active]:bg-muted data-[state=active]:border-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:shadow-none",
              )}
            >
              <mode.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? mode.iconColor : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className="whitespace-nowrap">{mode.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
