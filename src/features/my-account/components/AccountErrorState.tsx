import { ErrorState } from "@/components/ui/error-state";

interface AccountErrorStateProps {
  onRetry?: () => void;
}

export function AccountErrorState({ onRetry }: AccountErrorStateProps) {
  return (
    <ErrorState
      pageLayout
      title="Não foi possível carregar sua conta"
      description="Ocorreu um erro ao buscar seus dados. Verifique sua conexão com a internet e tente novamente."
      onRetry={onRetry}
    />
  );
}
