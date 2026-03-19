import { Briefcase, MapPin } from "lucide-react";

export interface JobsEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function JobsEmptyState({ hasFilters, onClearFilters }: JobsEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Briefcase className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-semibold">
          Nenhum trabalho encontrado
        </h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tente ajustar os filtros ou aumentar o raio de busca para encontrar
          mais oportunidades.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Nenhuma oportunidade na sua região
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Não encontramos pedidos abertos compatíveis com seus serviços e área de
        atendimento. Novas oportunidades aparecerão aqui assim que surgirem.
      </p>
    </div>
  );
}
