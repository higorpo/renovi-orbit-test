import { LoadMoreButton } from "@/components/ui/load-more-button";
import { useProviderSentBudgets } from "../hooks/useProviderSentBudgets";
import { useProviderPendingApprovalBudgetsCount } from "../hooks/useProviderPendingApprovalBudgetsCount";
import { useProviderBudgetsFilters } from "../hooks/useProviderBudgetsFilters";
import { BudgetsHeader } from "./BudgetsHeader";
import { BudgetsFilterChips } from "./BudgetsFilterChips";
import { BudgetCard } from "./BudgetCard";
import { BudgetCardSkeleton } from "./BudgetCardSkeleton";
import { BudgetsEmptyState } from "./BudgetsEmptyState";
import { BudgetsErrorState } from "./BudgetsErrorState";

const SKELETON_COUNT = 4;

export function ProviderBudgetsPage() {
  const {
    budgetStatusFilter,
    setBudgetStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    budgetStatusParam,
    searchParam,
    hasActiveFilters,
  } = useProviderBudgetsFilters();

  const budgets = useProviderSentBudgets({
    status: budgetStatusParam,
    search: searchParam,
  });

  const pendingApprovalBudgetsCount = useProviderPendingApprovalBudgetsCount();

  return (
    <div className="container max-w-5xl px-4 py-6">
      <BudgetsHeader
        pendingApprovalBudgetCount={pendingApprovalBudgetsCount.count}
        isLoading={pendingApprovalBudgetsCount.isLoading}
        pendingApprovalCountError={pendingApprovalBudgetsCount.isError}
      />

      <div className="mt-6 space-y-4">
        <BudgetsFilterChips
          budgetStatusFilter={budgetStatusFilter}
          searchQuery={searchQuery}
          onBudgetStatusChange={setBudgetStatusFilter}
          onSearchChange={setSearchQuery}
          disabled={budgets.isLoading || budgets.isError}
        />

        <BudgetsTabContent
          isLoading={budgets.isLoading}
          isError={budgets.isError}
          onRetry={() => void budgets.refetch()}
          isEmpty={budgets.items.length === 0}
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          hasNextPage={budgets.hasNextPage}
          isFetchingNextPage={budgets.isFetchingNextPage}
          onLoadMore={() => budgets.fetchNextPage()}
        >
          <ul className="grid gap-4">
            {budgets.items.map((budget) => (
              <li key={budget.id}>
                <BudgetCard budget={budget} />
              </li>
            ))}
          </ul>
        </BudgetsTabContent>
      </div>
    </div>
  );
}

function BudgetsTabContent({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  hasFilters,
  onClearFilters,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isEmpty: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <ul className="grid gap-4" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <li key={i}>
            <BudgetCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return <BudgetsErrorState onRetry={onRetry} />;
  }

  if (isEmpty) {
    return (
      <BudgetsEmptyState
        hasFilters={hasFilters}
        onClearFilters={hasFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <>
      {children}

      {hasNextPage && (
        <LoadMoreButton onLoadMore={onLoadMore} isLoading={isFetchingNextPage} />
      )}
    </>
  );
}
