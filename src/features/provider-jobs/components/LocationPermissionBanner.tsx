import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LocationPermissionBannerProps {
  permissionDenied: boolean;
  onRetry: () => void;
}

export function LocationPermissionBanner({
  permissionDenied,
  onRetry,
}: LocationPermissionBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="flex-1">
        {permissionDenied ? (
          <>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Localização não permitida
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Ative a localização nas configurações para ver
              trabalhos mais próximos de você. Enquanto isso, mostrando
              resultados com localização aproximada.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Usando localização aproximada
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Não foi possível obter sua localização exata. As distâncias
              mostradas são aproximadas.
            </p>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="mt-1.5 h-7 gap-1 text-xs text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 -ml-[12px] hover:bg-transparent"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
