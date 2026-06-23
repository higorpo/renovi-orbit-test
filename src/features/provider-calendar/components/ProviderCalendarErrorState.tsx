import { ErrorState } from "@/components/ui/error-state";

export interface ProviderCalendarErrorStateProps {
  onRetry: () => void;
}

export function ProviderCalendarErrorState({ onRetry }: ProviderCalendarErrorStateProps) {
  return (
    <ErrorState
      title="Não foi possível carregar o calendário"
      description="Verifique sua conexão e tente novamente."
      onRetry={onRetry}
      retryLabel="Tentar novamente"
      descriptionMaxWidth="md"
    />
  );
}
