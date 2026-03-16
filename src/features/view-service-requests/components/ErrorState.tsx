import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

const TITLE = "Não foi possível carregar seus serviços";
const SUPPORT_TEXT =
  "Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com o suporte.";
const RETRY_LABEL = "Tentar novamente";

export interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center shadow-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle
          className="h-10 w-10 text-destructive sm:h-12 sm:w-12"
          aria-hidden
        />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground sm:text-xl">
        {TITLE}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {SUPPORT_TEXT}
      </p>
      <Button
        variant="outline"
        className="mt-6 gap-2"
        onClick={onRetry}
        aria-label={RETRY_LABEL}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {RETRY_LABEL}
      </Button>
    </div>
  );
}
