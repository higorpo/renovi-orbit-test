import { ErrorState } from "@/components/ui/error-state";

interface ClientBudgetsErrorStateProps {
  onRetry: () => void;
}

export function ClientBudgetsErrorState({ onRetry }: ClientBudgetsErrorStateProps) {
  return (
    <ErrorState
      title="Erro ao carregar dados"
      description="Não foi possível buscar os dados dos seus orçamentos agora."
      onRetry={onRetry}
    />
  );
}
