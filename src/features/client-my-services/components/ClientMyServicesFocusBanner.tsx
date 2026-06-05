import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceModel } from "@/features/view-services";

export interface ClientMyServicesFocusBannerProps {
  focusServiceRequestId: string | null;
  focusedRequest: ServiceModel | null;
  isLoading: boolean;
  onClearFocus: () => void;
}

export function ClientMyServicesFocusBanner({
  focusServiceRequestId,
  focusedRequest,
  isLoading,
  onClearFocus,
}: ClientMyServicesFocusBannerProps) {
  if (!focusServiceRequestId) return null;

  const description = (() => {
    if (isLoading) return "Carregando o pedido selecionado…";
    if (focusedRequest) {
      return `Você está vendo apenas este pedido: “${focusedRequest.title}”.`;
    }
    return "Não encontramos esse pedido na sua lista. O link pode estar incorreto ou o pedido não está mais disponível.";
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-foreground shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 gap-3">
          <Filter className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold leading-snug">Filtro ativo: um pedido</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 w-full shrink-0 sm:w-auto"
          onClick={onClearFocus}
        >
          Ver todos os serviços
        </Button>
      </div>
    </div>
  );
}
