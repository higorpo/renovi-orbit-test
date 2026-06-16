import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useService } from "@/features/view-services";

export interface ChatListServiceRequestFilterBannerProps {
  serviceRequestId: string;
  onClearFilter: () => void;
}

export function ChatListServiceRequestFilterBanner({
  serviceRequestId,
  onClearFilter,
}: ChatListServiceRequestFilterBannerProps) {
  const { data: service, isLoading, isError } = useService(serviceRequestId);

  const description = (() => {
    if (isLoading) return "Carregando conversas deste pedido…";
    if (service?.title) {
      return `Mostrando conversas com prestadores sobre “${service.title}”.`;
    }
    if (isError) {
      return "Não foi possível carregar os detalhes deste pedido.";
    }
    return "Mostrando conversas deste pedido de serviço.";
  })();

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-3 mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-foreground shadow-sm"
    >
      <div className="flex flex-col gap-3">
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
          className="h-9 min-h-9 w-full"
          onClick={onClearFilter}
        >
          Ver todas as conversas
        </Button>
      </div>
    </div>
  );
}
