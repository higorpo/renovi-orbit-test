import { useState } from "react";
import { Link } from "react-router";
import { ROUTE_ACCOUNT_RECEIVABLES } from "@/features/my-account";
import { DEFAULT_SETTLEMENT_FILTER_ID } from "../constants/filterTabs";
import { useProviderSettlements } from "../hooks/useProviderSettlements";
import type { SettlementFilterId } from "../types/settlements.types";
import { EarningsFilterTabs } from "./EarningsFilterTabs";
import { SettlementMovementsList } from "./SettlementMovementsList";

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
    <div className="container w-full min-w-0 max-w-5xl px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Ganhos</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Liquidações previstas e depositadas na sua conta bancária.
        </p>
        <p className="text-sm text-muted-foreground">
          Valores pagos pelo cliente na plataforma ficam em{" "}
          <Link
            to={ROUTE_ACCOUNT_RECEIVABLES}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Minha conta → Recebimentos
          </Link>
          .
        </p>
      </header>

      <div className="mt-6 space-y-4">
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
    </div>
  );
}
