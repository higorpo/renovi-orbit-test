import { FileText, MessageCircleQuestion } from "lucide-react";

export interface BudgetsHeaderProps {
  /** Proposals with status submitted (awaiting client approval), not affected by list filters. */
  pendingApprovalBudgetCount: number;
  pendingQuestionsCount: number;
  /** Enquanto as duas listas (orçamentos + perguntas) carregam na entrada da tela. */
  isLoading: boolean;
  pendingApprovalCountError?: boolean;
  pendingQuestionsCountError?: boolean;
}

export function BudgetsHeader({
  pendingApprovalBudgetCount,
  pendingQuestionsCount,
  isLoading,
  pendingApprovalCountError,
  pendingQuestionsCountError,
}: BudgetsHeaderProps) {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Orçamentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Acompanhe os orçamentos que você enviou e as perguntas feitas aos
          clientes
        </p>
      </div>

      {!isLoading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {pendingApprovalCountError ? (
              <>— orçamentos (indisponível)</>
            ) : (
              <>
                {pendingApprovalBudgetCount}{" "}
                {pendingApprovalBudgetCount === 1
                  ? "orçamento aguardando aprovação"
                  : "orçamentos aguardando aprovação"}
              </>
            )}
          </span>
          {(pendingQuestionsCount > 0 || pendingQuestionsCountError) && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <MessageCircleQuestion
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              {pendingQuestionsCountError ? (
                <>— perguntas (indisponível)</>
              ) : (
                <>
                  {pendingQuestionsCount} pergunta{pendingQuestionsCount !== 1 ? "s" : ""}{" "}
                  aguardando resposta
                </>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
