import { ErrorState } from "@/components/ui/error-state";

export interface BudgetsErrorStateProps {
  onRetry: () => void;
}

export function BudgetsErrorState({ onRetry }: BudgetsErrorStateProps) {
  return (
    <ErrorState
      title="Erro ao carregar dados"
      description="Não foi possível buscar seus orçamentos. Verifique sua conexão e tente novamente."
      onRetry={onRetry}
    />
  );
}
