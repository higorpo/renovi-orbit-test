import { ErrorState } from "@/components/ui/error-state";

export type EarningsErrorStateProps = {
  onRetry: () => void;
};

export function EarningsErrorState({ onRetry }: EarningsErrorStateProps) {
  return (
    <ErrorState
      title="Erro ao carregar ganhos"
      description="Não foi possível carregar suas liquidações. Verifique sua conexão e tente novamente."
      onRetry={onRetry}
    />
  );
}
