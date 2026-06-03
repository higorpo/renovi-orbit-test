import { useState, type ReactNode } from "react";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ClientBudgetsHeader } from "./ClientBudgetsHeader";
import { ClientBudgetsFiltersBar } from "./ClientBudgetsFiltersBar";
import { ReceivedBudgetServiceCard } from "./ReceivedBudgetServiceCard";
import { ReceivedBudgetDetailsSheet } from "./ReceivedBudgetDetailsSheet";
import { ClientBudgetsErrorState } from "./ClientBudgetsErrorState";
import { ClientBudgetsEmptyState } from "./ClientBudgetsEmptyState";
import { ReceivedBudgetCardSkeleton } from "./ReceivedBudgetCardSkeleton";
import { useClientBudgetsFilters } from "../hooks/useClientBudgetsFilters";
import { useClientReceivedBudgets } from "../hooks/useClientReceivedBudgets";
import { useClientPendingApprovalServicesCount } from "../hooks/useClientPendingApprovalServicesCount";
import { getReceivedBudgetSheetMode } from "../constants/status";

const SKELETON_COUNT = 4;

export function ClientBudgetsPage() {
  const {
    receivedStatusFilter,
    searchQuery,
    setSearchQuery,
    setReceivedStatusFilter,
    receivedStatusParam,
    searchParam,
    resetFilters,
    hasActiveFilters,
  } = useClientBudgetsFilters();

  const received = useClientReceivedBudgets({
    status: receivedStatusParam,
    search: searchParam,
  });

  const pendingApprovalServicesCount = useClientPendingApprovalServicesCount();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);

  const openReceivedDetails = (serviceRequestId: string) => {
    setSelectedServiceRequestId(serviceRequestId);
    setDetailsOpen(true);
  };

  return (
    <div className="container max-w-5xl px-4 py-6">
      <ClientBudgetsHeader
        pendingApprovalServiceCount={pendingApprovalServicesCount.count}
        isLoading={pendingApprovalServicesCount.isLoading}
        pendingApprovalCountError={pendingApprovalServicesCount.isError}
      />

      <div className="mt-6 space-y-4">
        <ClientBudgetsFiltersBar
          receivedStatusFilter={receivedStatusFilter}
          searchQuery={searchQuery}
          onReceivedStatusChange={setReceivedStatusFilter}
          onSearchChange={setSearchQuery}
          disabled={received.isLoading}
        />

        <BudgetListContent
          isLoading={received.isLoading}
          isError={received.isError}
          isEmpty={received.items.length === 0}
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          hasNextPage={received.hasNextPage}
          isFetchingNextPage={received.isFetchingNextPage}
          onLoadMore={() => received.fetchNextPage()}
          onRetry={() => void received.refetch()}
        >
          <ul className="grid gap-4">
            {received.items.map((item) => (
              <li key={item.service_request_id}>
                <ReceivedBudgetServiceCard
                  item={item}
                  statusFilter={receivedStatusFilter}
                  onOpenDetails={openReceivedDetails}
                />
              </li>
            ))}
          </ul>
        </BudgetListContent>
      </div>

      <ReceivedBudgetDetailsSheet
        open={detailsOpen}
        serviceRequestId={selectedServiceRequestId}
        sheetMode={getReceivedBudgetSheetMode(receivedStatusFilter)}
        onOpenChange={(next) => {
          if (!next) setDetailsOpen(false);
        }}
      />
    </div>
  );
}

function BudgetListContent({
  isLoading,
  isError,
  isEmpty,
  hasFilters,
  onClearFilters,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <ul className="grid gap-4" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <li key={index}>
            <ReceivedBudgetCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return <ClientBudgetsErrorState onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <ClientBudgetsEmptyState
        hasFilters={hasFilters}
        onClearFilters={hasFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <>
      {children}
      {hasNextPage ? (
        <LoadMoreButton onLoadMore={onLoadMore} isLoading={isFetchingNextPage} />
      ) : null}
    </>
  );
}
