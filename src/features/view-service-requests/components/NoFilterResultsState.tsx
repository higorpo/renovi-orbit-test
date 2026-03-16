import { Button } from "@/components/ui/button";
import { FilterX } from "lucide-react";

const TITLE = "Nenhum serviço encontrado";
const SUPPORT_TEXT =
  "Nenhum serviço corresponde aos filtros aplicados. Tente alterar ou limpar os filtros para ver mais resultados.";

export interface NoFilterResultsStateProps {
  /** When provided, shows a "Limpar filtros" button that calls this. */
  onClearFilters?: () => void;
}

export function NoFilterResultsState({
  onClearFilters,
}: NoFilterResultsStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-12 text-center shadow-sm"
      role="status"
      aria-label="Nenhum serviço encontrado com os filtros aplicados"
    >
      <div className="rounded-full bg-muted/60 p-4">
        <FilterX
          className="h-10 w-10 text-muted-foreground sm:h-12 sm:w-12"
          aria-hidden
        />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground sm:text-xl">
        {TITLE}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {SUPPORT_TEXT}
      </p>
      {onClearFilters && (
        <Button
          variant="outline"
          size="sm"
          className="mt-6 gap-2"
          onClick={onClearFilters}
        >
          <FilterX className="h-4 w-4" aria-hidden />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
