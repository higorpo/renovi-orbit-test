import { useState, type ReactNode } from "react";
import { MessageCircleQuestion, ReceiptText } from "lucide-react";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ClientBudgetsHeader } from "./ClientBudgetsHeader";
import { ClientBudgetsFiltersBar } from "./ClientBudgetsFiltersBar";
import { ReceivedBudgetServiceCard } from "./ReceivedBudgetServiceCard";
import { QuestionServiceCard } from "./QuestionServiceCard";
import { ReceivedBudgetDetailsSheet } from "./ReceivedBudgetDetailsSheet";
import { QuestionThreadSheet } from "./QuestionThreadSheet";
import { ClientBudgetsErrorState } from "./ClientBudgetsErrorState";
import { ClientBudgetsEmptyState } from "./ClientBudgetsEmptyState";
import { ReceivedBudgetCardSkeleton } from "./ReceivedBudgetCardSkeleton";
import { QuestionServiceCardSkeleton } from "./QuestionServiceCardSkeleton";
import { useClientBudgetsFilters } from "../hooks/useClientBudgetsFilters";
import { useClientReceivedBudgets } from "../hooks/useClientReceivedBudgets";
import { useClientBudgetQuestions } from "../hooks/useClientBudgetQuestions";
import { useClientPendingApprovalServicesCount } from "../hooks/useClientPendingApprovalServicesCount";
import { useClientPendingQuestionsCount } from "../hooks/useClientPendingQuestionsCount";
import type { ClientBudgetsTab } from "../types/client-budgets.types";
import { getReceivedBudgetSheetMode } from "../constants/status";

const SKELETON_COUNT = 4;

export function ClientBudgetsPage() {
  const {
    activeTab,
    setActiveTab,
    receivedStatusFilter,
    questionStatusFilter,
    searchQuery,
    setSearchQuery,
    setReceivedStatusFilter,
    setQuestionStatusFilter,
    receivedStatusParam,
    questionStatusParam,
    searchParam,
    resetFilters,
    hasActiveFilters,
  } = useClientBudgetsFilters();

  const received = useClientReceivedBudgets({
    status: receivedStatusParam,
    search: searchParam,
  });
  const questions = useClientBudgetQuestions({
    questionStatus: questionStatusParam,
    search: searchParam,
  });

  const pendingApprovalServicesCount = useClientPendingApprovalServicesCount();
  const pendingQuestionsTotal = useClientPendingQuestionsCount();

  const [detailsMode, setDetailsMode] = useState<"received" | "questions" | null>(null);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);

  const headerLoading =
    received.isLoading ||
    questions.isLoading ||
    pendingApprovalServicesCount.isLoading ||
    pendingQuestionsTotal.isLoading;

  const openReceivedDetails = (serviceRequestId: string) => {
    setSelectedServiceRequestId(serviceRequestId);
    setDetailsMode("received");
  };

  const openQuestionDetails = (serviceRequestId: string) => {
    setSelectedServiceRequestId(serviceRequestId);
    setDetailsMode("questions");
  };

  return (
    <div className="container max-w-5xl px-4 py-6">
      <ClientBudgetsHeader
        pendingApprovalServiceCount={pendingApprovalServicesCount.count}
        pendingQuestionsCount={pendingQuestionsTotal.count}
        isLoading={headerLoading}
        pendingApprovalCountError={pendingApprovalServicesCount.isError}
        pendingQuestionsCountError={pendingQuestionsTotal.isError}
      />

      <div className="mt-6 space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as ClientBudgetsTab);
            resetFilters();
          }}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="recebidos" className="flex-1 gap-1.5 sm:flex-initial">
              <ReceiptText className={cn("h-4 w-4", activeTab === "recebidos" ? "text-primary" : "text-muted-foreground")} />
              Recebidos
              {!received.isLoading ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                  {received.totalCount ?? '-'}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="perguntas" className="flex-1 gap-1.5 sm:flex-initial">
              <MessageCircleQuestion className={cn("h-4 w-4", activeTab === "perguntas" ? "text-primary" : "text-muted-foreground")} />
              Perguntas
              {!questions.isLoading ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
                  {questions.totalCount ?? '-'}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <ClientBudgetsFiltersBar
              activeTab={activeTab}
              receivedStatusFilter={receivedStatusFilter}
              questionStatusFilter={questionStatusFilter}
              searchQuery={searchQuery}
              onReceivedStatusChange={setReceivedStatusFilter}
              onQuestionStatusChange={setQuestionStatusFilter}
              onSearchChange={setSearchQuery}
              disabled={activeTab === "recebidos" ? received.isLoading : questions.isLoading}
            />
          </div>

          <TabsContent value="recebidos">
            <TabContent
              tab="recebidos"
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
            </TabContent>
          </TabsContent>

          <TabsContent value="perguntas">
            <TabContent
              tab="perguntas"
              isLoading={questions.isLoading}
              isError={questions.isError}
              isEmpty={questions.items.length === 0}
              hasFilters={hasActiveFilters}
              onClearFilters={resetFilters}
              hasNextPage={questions.hasNextPage}
              isFetchingNextPage={questions.isFetchingNextPage}
              onLoadMore={() => questions.fetchNextPage()}
              onRetry={() => void questions.refetch()}
            >
              <ul className="grid gap-4">
                {questions.items.map((item) => (
                  <li key={item.service_request_id}>
                    <QuestionServiceCard
                      item={item}
                      statusFilter={questionStatusFilter}
                      onOpenDetails={openQuestionDetails}
                    />
                  </li>
                ))}
              </ul>
            </TabContent>
          </TabsContent>
        </Tabs>
      </div>

      <ReceivedBudgetDetailsSheet
        open={detailsMode === "received"}
        serviceRequestId={selectedServiceRequestId}
        sheetMode={getReceivedBudgetSheetMode(receivedStatusFilter)}
        onOpenChange={(next) => {
          if (!next) setDetailsMode(null);
        }}
      />
      <QuestionThreadSheet
        open={detailsMode === "questions"}
        serviceRequestId={selectedServiceRequestId}
        onOpenChange={(next) => {
          if (!next) setDetailsMode(null);
        }}
      />
    </div>
  );
}

function TabContent({
  tab,
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
  tab: ClientBudgetsTab;
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
    const SkeletonComponent =
      tab === "recebidos" ? ReceivedBudgetCardSkeleton : QuestionServiceCardSkeleton;
    return (
      <ul className="grid gap-4" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <li key={index}>
            <SkeletonComponent />
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
        tab={tab}
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
