import { FileText } from "lucide-react";

export interface BudgetsHeaderProps {
  /** Proposals with status submitted (awaiting client approval), not affected by list filters. */
  pendingApprovalBudgetCount: number;
  isLoading: boolean;
  pendingApprovalCountError?: boolean;
}

export function BudgetsHeader({
  pendingApprovalBudgetCount,
  isLoading,
  pendingApprovalCountError,
}: BudgetsHeaderProps) {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Orçamentos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Acompanhe os orçamentos que você enviou
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
        </div>
      )}
    </div>
  );
}
