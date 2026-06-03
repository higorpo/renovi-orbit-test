import { FileText } from "lucide-react";

interface ClientBudgetsHeaderProps {
  /** Service requests with a budget awaiting client approval; not affected by list filters. */
  pendingApprovalServiceCount: number;
  isLoading: boolean;
  pendingApprovalCountError?: boolean;
}

export function ClientBudgetsHeader({
  pendingApprovalServiceCount,
  isLoading,
  pendingApprovalCountError,
}: ClientBudgetsHeaderProps) {
  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Orçamentos</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Acompanhe os orçamentos recebidos dos prestadores
        </p>
      </div>
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {pendingApprovalCountError ? (
              <>— serviços (indisponível)</>
            ) : (
              <>
                {pendingApprovalServiceCount}{" "}
                {pendingApprovalServiceCount === 1
                  ? "serviço com orçamento aguardando aprovação"
                  : "serviços com orçamento aguardando aprovação"}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
