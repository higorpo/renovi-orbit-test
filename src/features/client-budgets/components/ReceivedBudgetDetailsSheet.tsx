import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProviderProfileInlinePreview } from "@/features/provider-profile";
import { useClientBudgetDetail } from "../hooks/useClientBudgetDetail";
import { BudgetStatusBadge } from "./BudgetStatusBadge";
import { CurrentProposalVersionBlock } from "./CurrentProposalVersionBlock";
import type { ClientBudgetDetailProposal } from "../types/client-budgets.types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface ReceivedBudgetDetailsSheetProps {
  open: boolean;
  serviceRequestId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ReceivedBudgetDetailsSheet({
  open,
  serviceRequestId,
  onOpenChange,
}: ReceivedBudgetDetailsSheetProps) {
  const { detail, isLoading } = useClientBudgetDetail(serviceRequestId);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-none overflow-y-auto p-0 sm:max-w-2xl"
      >
        <div className="space-y-4 p-4 sm:p-6">
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle>Comparar orçamentos</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {detail?.service_request.title ?? "Carregando..."}
            </p>
          </SheetHeader>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando detalhes...</p>
          ) : groupedByProvider.length === 0 ? (
            <Alert>
              <AlertTitle>Nenhum orçamento encontrado</AlertTitle>
              <AlertDescription>
                Este pedido ainda não possui orçamentos ativos para comparação.
              </AlertDescription>
            </Alert>
          ) : (
            groupedByProvider.map(([providerId, providerBudgets]) => {
              const latest = providerBudgets[0];
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
                    <Button size="sm" variant="outline" disabled>
                      Recusar orçamento
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
