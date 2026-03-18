import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AccountErrorStateProps {
  onRetry?: () => void;
}

export function AccountErrorState({ onRetry }: AccountErrorStateProps) {
  return (
    <div className="container max-w-4xl px-4 py-6">
      <div className="flex flex-col items-center justify-center text-center gap-5 py-16 px-4 rounded-xl border border-dashed">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            Não foi possível carregar sua conta
          </h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro ao buscar seus dados. Verifique sua conexão com a internet e tente novamente.
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
