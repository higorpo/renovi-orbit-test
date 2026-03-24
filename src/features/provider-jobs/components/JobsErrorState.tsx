import { ErrorState } from "@/components/ui/error-state";

export interface JobsErrorStateProps {
  onRetry: () => void;
}

export function JobsErrorState({ onRetry }: JobsErrorStateProps) {
  return (
    <ErrorState
      title="Erro ao carregar trabalhos"
      description="Não foi possível buscar as oportunidades disponíveis. Verifique sua conexão e tente novamente."
      onRetry={onRetry}
    />
  );
}
