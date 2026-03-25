import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderProfileInlinePreview } from "@/features/provider-profile";
import { useClientBudgetDetail } from "../hooks/useClientBudgetDetail";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { BudgetRejectReasonDialog } from "./BudgetRejectReasonDialog";
import { CurrentProposalVersionBlock } from "./CurrentProposalVersionBlock";
import type { ClientBudgetDetailProposal } from "../types/client-budgets.types";
import { getReceivedBudgetSheetTitle, type ReceivedBudgetSheetMode } from "../constants/status";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface ReceivedBudgetDetailsSheetProps {
  open: boolean;
  serviceRequestId: string | null;
  sheetMode: ReceivedBudgetSheetMode;
  onOpenChange: (open: boolean) => void;
}

export function ReceivedBudgetDetailsSheet({
  open,
  serviceRequestId,
  sheetMode,
  onOpenChange,
}: ReceivedBudgetDetailsSheetProps) {
  const { detail, isLoading } = useClientBudgetDetail(serviceRequestId);
  const [rejectProposalId, setRejectProposalId] = useState<string | null>(null);

  const groupedByProvider = useMemo(() => {
    const budgets = detail?.budgets ?? [];
    const map = new Map<string, ClientBudgetDetailProposal[]>();
    budgets.forEach((item) => {
      const key = item.provider_id;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    });
    return [...map.entries()];
  }, [detail?.budgets]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          hideCloseButton
          className="flex w-full flex-col gap-0 border-l p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
        >
          <SheetHeader className="relative h-14 flex-row items-center space-y-0 border-b px-4 pr-16 sm:h-16 sm:px-6 sm:pr-20">
            <SheetTitle>{getReceivedBudgetSheetTitle(sheetMode)}</SheetTitle>
            <SheetClose asChild>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-background opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none sm:right-6"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </SheetClose>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  <Skeleton className="h-4 w-[min(100%,18rem)]" aria-hidden />
                ) : (
                  <p>{detail?.service_request.title ?? "—"}</p>
                )}
              </div>

              {isLoading ? (
                <div
                  className="space-y-4"
                  aria-busy="true"
                  aria-label="Carregando detalhes do orçamento"
                >
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </div>
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-32" />
                    </div>
                  </div>
                </div>
              ) : groupedByProvider.length === 0 ? (
                <Alert>
                  <AlertTitle>Nenhum orçamento encontrado</AlertTitle>
                  <AlertDescription>
                    {sheetMode === "compare"
                      ? "Este pedido ainda não possui orçamentos ativos para comparação."
                      : "Este pedido ainda não possui orçamentos registrados."}
                  </AlertDescription>
                </Alert>
              ) : (
                groupedByProvider.map(([providerId, providerBudgets]) => {
                  const latest = providerBudgets[0];
                  const canReject = sheetMode === "compare" && latest.status === "submitted";
                  return (
                    <div key={providerId} className="space-y-3 rounded-lg border p-3">
                      <ProviderProfileInlinePreview
                        providerName={latest.provider_name}
                        providerSlug={latest.provider_slug}
                        providerProfileImagePath={latest.provider_profile_image_path}
                      />
                      <CurrentProposalVersionBlock proposal={latest} />
                      {providerBudgets.length > 1 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Histórico
                          </p>
                          {providerBudgets.slice(1).map((history) => (
                            <div key={history.id} className="rounded-lg border border-dashed p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                  {formatCurrency(history.proposed_amount)}
                                </p>
                                <BudgetStatusBadge status={history.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="secondary" disabled>
                          Aprovar orçamento
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={!canReject}
                          onClick={() => setRejectProposalId(latest.id)}
                        >
                          Recusar orçamento
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <BudgetRejectReasonDialog
        open={rejectProposalId !== null}
        onOpenChange={(next) => {
          if (!next) setRejectProposalId(null);
        }}
        serviceRequestId={serviceRequestId}
        proposalId={rejectProposalId}
      />
    </>
  );
}
