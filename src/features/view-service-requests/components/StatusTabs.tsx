import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_TABS } from "../constants/statusTabs";
import type { StatusTabId } from "../constants/statusTabs";

export interface StatusTabsProps {
  activeTabId: StatusTabId;
  onTabChange: (tabId: StatusTabId) => void;
  counts?: Partial<Record<StatusTabId, number>>;
  disabled?: boolean;
}

export function StatusTabs({
  activeTabId,
  onTabChange,
  counts = {},
  disabled,
}: StatusTabsProps) {
  return (
    <TabsList
      className="w-full justify-start overflow-x-auto"
      role="tablist"
      aria-label="Filtrar por status"
    >
      {STATUS_TABS.map((tab) => {
        const count = counts[tab.id];
        const label =
          count !== undefined && count !== null
            ? `${tab.label} (${count})`
            : tab.label;
        return (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            onClick={() => onTabChange(tab.id)}
            disabled={disabled}
            role="tab"
            aria-selected={activeTabId === tab.id}
            aria-controls={`panel-${tab.id}`}
          >
            {label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
