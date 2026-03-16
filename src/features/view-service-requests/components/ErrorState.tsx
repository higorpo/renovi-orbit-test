import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const TITLE = "Não foi possível carregar seus serviços";
const RETRY_LABEL = "Tentar novamente";

export interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-12 text-center"
      role="alert"
      aria-live="polite"
    >
      <AlertCircle
        className="h-12 w-12 text-destructive sm:h-14 sm:w-14"
        aria-hidden
      />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{TITLE}</h2>
      <Button variant="outline" className="mt-6" onClick={onRetry}>
        {RETRY_LABEL}
      </Button>
    </div>
  );
}
