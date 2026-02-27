import { Button } from "@/components/ui/button";
import type { ServiceWithChildren } from "@/features/request-quote";
import { useRequestQuoteServices } from "../../hooks/useRequestQuoteServices";

export interface Step1ServiceSelectProps {
  urlServiceSlug: string | null;
  loadingSession: boolean;
  setSelectedService: (service: ServiceWithChildren | null) => void;
  onServiceSelect: (service: ServiceWithChildren) => void;
}

export function Step1ServiceSelect({
  urlServiceSlug,
  loadingSession,
  setSelectedService,
  onServiceSelect,
}: Step1ServiceSelectProps) {
  const { services, isLoading, error } = useRequestQuoteServices({
    urlServiceSlug,
    loadingSession,
    setSelectedService,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Escolha o tipo de serviço</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((srv) => (
          <div key={srv.id}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full flex flex-col items-start p-4 text-left border-white/30 text-white hover:bg-white/10"
              onClick={() => onServiceSelect(srv)}
            >
              <span className="font-medium">{srv.title}</span>
              {srv.description && (
                <span className="text-sm text-white/80 mt-1">{srv.description}</span>
              )}
            </Button>
            {srv.children && srv.children.length > 0 && (
              <div className="mt-2 pl-4 space-y-2">
                {srv.children.map((sub) => (
                  <Button
                    key={sub.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-white/90 hover:bg-white/10"
                    onClick={() => onServiceSelect(sub)}
                  >
                    {sub.title}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {isLoading && (
        <p className="text-white/70">Carregando serviços...</p>
      )}
      {!isLoading && services.length === 0 && !error && (
        <p className="text-white/70">Nenhum serviço disponível no momento.</p>
      )}
    </div>
  );
}
