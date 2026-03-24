import { ErrorState as ErrorStateUi } from "@/components/ui/error-state";

const TITLE = "Não foi possível carregar seus serviços";
const SUPPORT_TEXT =
  "Verifique sua conexão e tente novamente. Se o problema persistir, entre em contato com o suporte.";
const RETRY_LABEL = "Tentar novamente";

export interface ErrorStateProps {
  onRetry: () => void;
}

export function ClientMyServicesErrorState({ onRetry }: ErrorStateProps) {
  return (
    <ErrorStateUi
      title={TITLE}
      description={SUPPORT_TEXT}
      onRetry={onRetry}
      retryLabel={RETRY_LABEL}
      descriptionMaxWidth="md"
    />
  );
}
