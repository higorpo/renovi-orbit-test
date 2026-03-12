import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ServiceWithChildren } from "@/features/request-quote";
import { useRequestQuoteServices } from "../../hooks/useRequestQuoteServices";
import { getServiceCardStyle, SERVICE_PLACEHOLDER_IMAGE } from "../../utils/serviceCardStyle";

export interface Step1ServiceSelectProps {
  urlServiceSlug: string | null;
  loadingSession: boolean;
  selectedService: ServiceWithChildren | null;
  setSelectedService: (service: ServiceWithChildren | null) => void;
  onServiceSelect: (service: ServiceWithChildren) => void;
}

export function Step1ServiceSelect({
  urlServiceSlug,
  loadingSession,
  selectedService,
  setSelectedService,
  onServiceSelect,
}: Step1ServiceSelectProps) {
  const { services, isLoading, error } = useRequestQuoteServices({
    urlServiceSlug,
    loadingSession,
    setSelectedService,
  });

  const flatServices = useMemo(() => {
    const list: ServiceWithChildren[] = [];
    for (const root of services) {
      list.push(root);
      if (root.children?.length) {
        list.push(...root.children);
      }
    }
    return list;
  }, [services]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-semibold text-foreground">Escolha o tipo de serviço</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4">
        {flatServices.map((srv) => {
          const isSelected = selectedService?.id === srv.id;
          const { Icon, color } = getServiceCardStyle(srv);
          const imageUrl = srv.image_url || SERVICE_PLACEHOLDER_IMAGE;
          const imageAlt = srv.description || srv.title;
          return (
            <button
              key={srv.id}
              type="button"
              onClick={() => onServiceSelect(srv)}
              className={`group relative aspect-[4/3] rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                isSelected
                  ? "ring-2 ring-accent shadow-xl scale-[1.02]"
                  : "shadow-md hover:shadow-lg hover:scale-[1.01]"
              }`}
            >
              <img
                src={imageUrl}
                alt={imageAlt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = SERVICE_PLACEHOLDER_IMAGE;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20 pointer-events-none" />
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 bg-accent rounded-full flex items-center justify-center shadow-lg pointer-events-none">
                  <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
              <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 md:top-3 md:left-3 pointer-events-none">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg`}
                >
                  <Icon className="h-4 w-4 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 max-h-[90px] min-w-0 overflow-hidden p-2 sm:p-2.5 md:p-3 text-left">
                <h3 className="font-bold text-xs sm:text-sm md:text-base text-white truncate" title={srv.title}>
                  {srv.title}
                </h3>
                {srv.description && (
                  <p
                    className="text-white/80 text-[9px] sm:text-[10px] md:text-xs mt-0.5 hidden sm:block break-words"
                    title={srv.description}
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      maxHeight: "3.6em",
                    }}
                  >
                    {srv.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {isLoading && (
        <p className="text-muted-foreground">Carregando serviços...</p>
      )}
      {!isLoading && services.length === 0 && !error && (
        <p className="text-muted-foreground">Nenhum serviço disponível no momento.</p>
      )}
      <p className="text-center text-xs sm:text-sm text-muted-foreground mt-4 sm:mt-6">
        Selecione um serviço para continuar.{" "}
        <span className="font-medium">Nenhuma cobrança será feita agora.</span>
      </p>
    </div>
  );
}
