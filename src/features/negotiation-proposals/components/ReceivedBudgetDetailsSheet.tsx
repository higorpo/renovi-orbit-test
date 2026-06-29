import { useMemo } from "react";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AcceptProposalDialog } from "./AcceptProposalDialog";
import { BudgetCompareGuidancePanel } from "./BudgetCompareGuidancePanel";
import { BudgetCompareProviderCard } from "./BudgetCompareProviderCard";
import { BudgetCompareTrustPanel } from "./BudgetCompareTrustPanel";
import { RejectProposalDialog } from "./RejectProposalDialog";
import { RevisionRequestDialog } from "./RevisionRequestDialog";
import { useServiceRequestBudgetCompareDetail } from "../hooks/useServiceRequestBudgetCompareDetail";
import { useServiceRequestBudgetProposalDialogs } from "../hooks/useServiceRequestBudgetProposalDialogs";
import type { ServiceRequestBudgetCompareProposal } from "../types/serviceRequestBudgetCompare.types";
import {
  getServiceRequestBudgetSheetTitle,
  type ServiceRequestBudgetSheetMode,
} from "../constants/serviceRequestBudgetSheet";

interface ReceivedBudgetDetailsSheetProps {
  open: boolean;
  serviceRequestId: string | null;
  sheetMode: ServiceRequestBudgetSheetMode;
  onOpenChange: (open: boolean) => void;
}

function getLatestBudgetPerProvider(
  budgets: ServiceRequestBudgetCompareProposal[],
): ServiceRequestBudgetCompareProposal[] {
  const latestByProvider = new Map<string, ServiceRequestBudgetCompareProposal>();
  budgets.forEach((item) => {
    if (!latestByProvider.has(item.provider_id)) {
      latestByProvider.set(item.provider_id, item);
    }
  });
  return [...latestByProvider.values()];
}

export function ReceivedBudgetDetailsSheet({
  open,
  serviceRequestId,
  sheetMode,
  onOpenChange,
}: ReceivedBudgetDetailsSheetProps) {
  const { detail, isLoading, isError, refetch } = useServiceRequestBudgetCompareDetail(serviceRequestId);
  const dialogs = useServiceRequestBudgetProposalDialogs(serviceRequestId);

  const proposalsByProvider = useMemo(
    () => getLatestBudgetPerProvider(detail?.budgets ?? []),
    [detail?.budgets],
  );
  const providerCount = proposalsByProvider.length;
  const isCompareMode = sheetMode === "compare";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          hideCloseButton
          className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b bg-background px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
            <div className="min-w-0 space-y-0.5">
              <SheetTitle>{getServiceRequestBudgetSheetTitle(sheetMode)}</SheetTitle>
              {!isLoading && detail?.service_request.title ? (
                <p className="truncate text-sm text-muted-foreground">{detail.service_request.title}</p>
              ) : null}
            </div>
            <SheetClose asChild>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-6"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </SheetClose>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y bg-muted/10 p-4 sm:p-5">
            <div className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-4 w-[min(100%,18rem)]" aria-hidden />
              ) : providerCount > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {isCompareMode
                    ? `${providerCount} profissional${providerCount === 1 ? "" : "is"} com proposta para este pedido. Compare escopo, experiência e valor antes de decidir.`
                    : `${providerCount} profissional${providerCount === 1 ? "" : "is"} enviou proposta para este pedido.`}
                </p>
              ) : null}

              {isCompareMode && !isLoading && !isError && providerCount > 0 ? (
                <BudgetCompareGuidancePanel />
              ) : null}

              {!isLoading && !isError && providerCount > 0 ? (
                <BudgetCompareTrustPanel />
              ) : null}

              {isError ? (
                <Alert variant="destructive">
                  <AlertTitle>Não foi possível carregar os detalhes</AlertTitle>
                  <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span>Tente novamente em alguns instantes.</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : isLoading ? (
                <div
                  className="space-y-4"
                  aria-busy="true"
                  aria-label="Carregando detalhes do orçamento"
                >
                  <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-xl border bg-muted/10 p-3.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Skeleton className="h-10 w-28 rounded-full" />
                      <Skeleton className="h-10 w-28 rounded-full" />
                      <Skeleton className="h-10 w-32 rounded-full" />
                    </div>
                  </div>
                </div>
              ) : proposalsByProvider.length === 0 ? (
                <Alert>
                  <AlertTitle>Nenhum orçamento encontrado</AlertTitle>
                  <AlertDescription>
                    {isCompareMode
                      ? "Este pedido ainda não possui orçamentos ativos para comparação."
                      : "Este pedido ainda não possui orçamentos registrados."}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {proposalsByProvider.map((proposal) => (
                    <BudgetCompareProviderCard
                      key={proposal.provider_id}
                      proposal={proposal}
                      sheetMode={sheetMode}
                      onProposalAction={isCompareMode ? dialogs.handleProposalAction : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {dialogs.acceptOpen ? (
        <AcceptProposalDialog
          open
          onOpenChange={dialogs.handleAcceptDialogOpenChange}
          chatId={null}
          serviceRequestId={serviceRequestId}
          proposalId={dialogs.acceptProposalId}
          suggestedSlots={dialogs.acceptProposalDetailQuery.data?.proposal_suggested_slots ?? []}
          serviceTitle={detail?.service_request.title}
          isLoading={dialogs.acceptProposalDetailQuery.isLoading}
          isError={dialogs.acceptProposalDetailQuery.isError}
          onRetry={() => void dialogs.acceptProposalDetailQuery.refetch()}
          revisionCount={dialogs.acceptProposalDetailQuery.data?.revision_count ?? 0}
          onRequestRevision={dialogs.handleAcceptRequestRevision}
        />
      ) : null}

      {dialogs.rejectOpen ? (
        <RejectProposalDialog
          open
          onOpenChange={dialogs.handleRejectDialogOpenChange}
          chatId={null}
          serviceRequestId={serviceRequestId}
          proposalId={dialogs.rejectProposalId}
        />
      ) : null}

      {dialogs.revisionOpen ? (
        <RevisionRequestDialog
          open
          onOpenChange={dialogs.handleRevisionDialogOpenChange}
          chatId={null}
          serviceRequestId={serviceRequestId}
          proposalId={dialogs.revisionProposalId}
          revisionCount={dialogs.revisionProposalDetailQuery.data?.revision_count ?? 0}
          initialValues={dialogs.revisionInitialValues}
          isLoading={dialogs.revisionProposalDetailQuery.isLoading}
        />
      ) : null}
    </>
  );
}
