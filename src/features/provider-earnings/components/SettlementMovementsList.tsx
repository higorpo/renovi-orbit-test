import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Loader2 } from "lucide-react";
import type { SettlementMovement } from "../types/settlements.types";
import { groupSettlementsBySchedule } from "../utils/groupSettlementsBySchedule";
import { EarningsEmptyState } from "./EarningsEmptyState";
import { EarningsErrorState } from "./EarningsErrorState";
import { SettlementMovementCard } from "./SettlementMovementCard";

export type SettlementMovementsListProps = {
  items: SettlementMovement[];
  isLoading: boolean;
  isError: boolean;
  hasFilters: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
};

export function SettlementMovementsList({
  items,
  isLoading,
  isError,
  hasFilters,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  onClearFilters,
}: SettlementMovementsListProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border border-border px-4 py-8 text-sm text-muted-foreground"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando ganhos…
      </div>
    );
  }

  if (isError) {
    return <EarningsErrorState onRetry={onRetry} />;
  }

  if (items.length === 0) {
    return (
      <EarningsEmptyState hasFilters={hasFilters} onClearFilters={onClearFilters} />
    );
  }

  const groups = groupSettlementsBySchedule(items);

  return (
    <div className="space-y-4">
      <ul className="space-y-4" aria-label="Lista de liquidações">
        {groups.map((group, groupIndex) => {
          const isGrouped = group.items.length > 1 && group.paymentScheduleId != null;
          return (
            <li key={group.paymentScheduleId ?? `orphan-${groupIndex}`} className="min-w-0">
              {isGrouped ? (
                <div className="space-y-2 rounded-xl border border-border/80 bg-muted/20 p-3">
                  <p className="px-1 text-xs font-medium text-muted-foreground">
                    Parcelas do mesmo pagamento
                  </p>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <SettlementMovementCard item={item} className="bg-background" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <SettlementMovementCard item={group.items[0]} />
              )}
            </li>
          );
        })}
      </ul>

      {hasNextPage ? (
        <LoadMoreButton onLoadMore={onLoadMore} isLoading={isFetchingNextPage} />
      ) : null}
    </div>
  );
}
