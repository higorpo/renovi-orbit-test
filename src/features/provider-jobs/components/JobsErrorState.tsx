import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface JobsErrorStateProps {
  onRetry: () => void;
}

export function JobsErrorState({ onRetry }: JobsErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        Erro ao carregar trabalhos
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Não foi possível buscar as oportunidades disponíveis. Verifique sua
        conexão e tente novamente.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-4 w-4" aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}
