import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProviderSentBudgets } from "../hooks/useProviderSentBudgets";
import { useProviderOwnQuestions } from "../hooks/useProviderOwnQuestions";
import { useProviderPendingQuestionsCount } from "../hooks/useProviderPendingQuestionsCount";
import { useProviderPendingApprovalBudgetsCount } from "../hooks/useProviderPendingApprovalBudgetsCount";
import { useProviderBudgetsFilters } from "../hooks/useProviderBudgetsFilters";
import { BudgetsHeader } from "./BudgetsHeader";
import { BudgetsFilterChips } from "./BudgetsFilterChips";
import { BudgetCard } from "./BudgetCard";
import { BudgetCardSkeleton } from "./BudgetCardSkeleton";
import { QuestionCard } from "./QuestionCard";
import { QuestionCardSkeleton } from "./QuestionCardSkeleton";
import { BudgetsEmptyState } from "./BudgetsEmptyState";
import { BudgetsErrorState } from "./BudgetsErrorState";
import type { BudgetsTab } from "../types/provider-budgets.types";

const SKELETON_COUNT = 4;

export function ProviderBudgetsPage() {
  const {
    activeTab,
    setActiveTab,
    budgetStatusFilter,
    setBudgetStatusFilter,
    questionStatusFilter,
    setQuestionStatusFilter,
    searchQuery,
    setSearchQuery,
    resetFilters,
    budgetStatusParam,
    questionStatusParam,
    searchParam,
    hasActiveFilters,
  } = useProviderBudgetsFilters();

  const budgets = useProviderSentBudgets({
    status: budgetStatusParam,
    search: searchParam,
  });

  const questions = useProviderOwnQuestions({
    questionStatus: questionStatusParam,
    search: searchParam,
  });

  const pendingQuestionsCount = useProviderPendingQuestionsCount();
  const pendingApprovalBudgetsCount = useProviderPendingApprovalBudgetsCount();

  const isLoading =
    activeTab === "enviados" ? budgets.isLoading : questions.isLoading;
  const isError =
    activeTab === "enviados" ? budgets.isError : questions.isError;

  const headerLoading =
    budgets.isLoading ||
    questions.isLoading ||
    pendingQuestionsCount.isLoading ||
    pendingApprovalBudgetsCount.isLoading;

  return (
    <div className="container max-w-4xl px-4 py-6">
      <BudgetsHeader
        pendingApprovalBudgetCount={pendingApprovalBudgetsCount.count}
        pendingQuestionsCount={pendingQuestionsCount.count}
        isLoading={headerLoading}
      />

      <div className="mt-6 space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as BudgetsTab);
            resetFilters();
          }}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="enviados" className="flex-1 sm:flex-initial gap-1.5">
              <FileText className={cn("h-4 w-4 shrink-0", activeTab === "enviados" ? "text-primary" : "text-muted-foreground")} aria-hidden />
              Enviados
              {!budgets.isLoading && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                  {budgets.totalCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="perguntas" className="flex-1 sm:flex-initial gap-1.5">
              <MessageCircleQuestion className={cn("h-4 w-4 shrink-0", activeTab === "perguntas" ? "text-primary" : "text-muted-foreground")} aria-hidden />
              Perguntas
              {!questions.isLoading && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                  {questions.totalCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <BudgetsFilterChips
              activeTab={activeTab}
              budgetStatusFilter={budgetStatusFilter}
              questionStatusFilter={questionStatusFilter}
              searchQuery={searchQuery}
              onBudgetStatusChange={setBudgetStatusFilter}
              onQuestionStatusChange={setQuestionStatusFilter}
              onSearchChange={setSearchQuery}
              disabled={isLoading || isError}
            />
          </div>

          <TabsContent value="enviados">
            <BudgetsTabContent
              isLoading={budgets.isLoading}
              isError={budgets.isError}
              onRetry={() => void budgets.refetch()}
              isEmpty={budgets.items.length === 0}
              tab="enviados"
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
          </TabsContent>

          <TabsContent value="perguntas">
            <BudgetsTabContent
              isLoading={questions.isLoading}
              isError={questions.isError}
              onRetry={() => void questions.refetch()}
              isEmpty={questions.items.length === 0}
              tab="perguntas"
              hasFilters={hasActiveFilters}
              onClearFilters={resetFilters}
              hasNextPage={questions.hasNextPage}
              isFetchingNextPage={questions.isFetchingNextPage}
              onLoadMore={() => questions.fetchNextPage()}
            >
              <ul className="grid gap-4">
                {questions.items.map((q) => (
                  <li key={q.id}>
                    <QuestionCard question={q} />
                  </li>
                ))}
              </ul>
            </BudgetsTabContent>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BudgetsTabContent({
  isLoading,
  isError,
  onRetry,
  isEmpty,
  tab,
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
  tab: BudgetsTab;
  hasFilters: boolean;
  onClearFilters: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    const SkeletonComponent =
      tab === "enviados" ? BudgetCardSkeleton : QuestionCardSkeleton;
    return (
      <ul className="grid gap-4" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <li key={i}>
            <SkeletonComponent />
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
        tab={tab}
        hasFilters={hasFilters}
        onClearFilters={hasFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <>
      {children}

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Carregando…
              </>
            ) : (
              "Carregar mais"
            )}
          </Button>
        </div>
      )}
    </>
  );
}
