import { useState } from "react";
import { DEFAULT_SETTLEMENT_FILTER_ID } from "../constants/filterTabs";
import { useProviderSettlements } from "../hooks/useProviderSettlements";
import type { SettlementFilterId } from "../types/settlements.types";
import { EarningsFilterTabs } from "./EarningsFilterTabs";
import { SettlementMovementsList } from "./SettlementMovementsList";

/** Bank-settlement list (Previsto / Liquidado). Hosted inside the Ganhos hub. */
export function EarningsPage() {
  const [filterId, setFilterId] = useState<SettlementFilterId>(DEFAULT_SETTLEMENT_FILTER_ID);
  const {
    items,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useProviderSettlements({ filterId });

  const hasFilters = filterId !== DEFAULT_SETTLEMENT_FILTER_ID;

  return (
    <div className="space-y-4">
      <EarningsFilterTabs
        activeFilter={filterId}
        onFilterChange={setFilterId}
        disabled={isLoading}
      />

      <SettlementMovementsList
        items={items}
        isLoading={isLoading}
        isError={isError}
        hasFilters={hasFilters}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => {
          void fetchNextPage();
        }}
        onRetry={refetch}
        onClearFilters={() => setFilterId(DEFAULT_SETTLEMENT_FILTER_ID)}
      />
    </div>
  );
}
