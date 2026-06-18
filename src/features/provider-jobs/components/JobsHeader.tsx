import { MapPin } from "lucide-react";

export interface JobsHeaderProps {
  isUsingDefaultLocation: boolean;
}

export function JobsHeader({ isUsingDefaultLocation }: JobsHeaderProps) {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Trabalhos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Oportunidades compatíveis com sua área de atuação e região
        </p>
      </div>

      {isUsingDefaultLocation && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Sem GPS do feed — ordenação por recência</span>
          </span>
        </div>
      )}
    </div>
  );
}
