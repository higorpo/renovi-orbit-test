import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_TABS } from "../../constants/statusTabs";
import { STATUS_TAB_DISPLAY } from "../../constants/statusTabDisplay";
import type { StatusTabId } from "../../constants/statusTabs";
import { cn } from "@/lib/utils";

export interface StatusTabsProps {
  activeTabId: StatusTabId;
  onTabChange: (tabId: StatusTabId) => void;
  disabled?: boolean;
}

export function MyServicesStatusTabs({
  activeTabId,
  onTabChange,
  disabled,
}: StatusTabsProps) {
  return (
    <TabsList
      className={cn(
        "w-full justify-start gap-2 overflow-x-auto p-0",
        "bg-transparent min-h-0 rounded-none",
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        "snap-x snap-mandatory scroll-smooth"
      )}
      role="tablist"
      aria-label="Filtrar por status"
    >
      {STATUS_TABS.map((tab) => {
        const { Icon, iconColor } = STATUS_TAB_DISPLAY[tab.id];
        const isActive = activeTabId === tab.id;
        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            onClick={() => onTabChange(tab.id)}
            disabled={disabled}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            className={cn(
              "gap-1.5 rounded-full border border-muted-foreground/10 bg-transparent",
              "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              "data-[state=active]:bg-muted data-[state=active]:border-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:shadow-none"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? iconColor : "text-muted-foreground",
                tab.id === "in_progress" && isActive && "animate-spin"
              )}
              aria-hidden
            />
            <span className="whitespace-nowrap">{tab.label}</span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
