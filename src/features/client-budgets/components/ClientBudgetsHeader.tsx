import { FileText, MessageCircleQuestion } from "lucide-react";

interface ClientBudgetsHeaderProps {
  receivedCount: number;
  pendingQuestionsCount: number;
  isLoading: boolean;
}

export function ClientBudgetsHeader({
  receivedCount,
  pendingQuestionsCount,
  isLoading,
}: ClientBudgetsHeaderProps) {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orçamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Acompanhe os orçamentos recebidos e responda às perguntas dos prestadores
        </p>
      </div>
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {receivedCount} serviço{receivedCount !== 1 ? "s" : ""} com orçamento
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {pendingQuestionsCount} pergunta{pendingQuestionsCount !== 1 ? "s" : ""} pendente
          </span>
        </div>
      )}
    </div>
  );
}
