import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { Undo2, Wallet } from "lucide-react";
import type { SettlementMovement } from "../types/settlements.types";
import {
  formatSettlementDate,
  formatSettlementInstallmentLabel,
  formatSettlementMovementStatus,
  formatSettlementSettledLabel,
  isSettlementDebit,
} from "../utils/formatSettlementMovement";

export type SettlementMovementCardProps = {
  item: SettlementMovement;
  className?: string;
};

export function SettlementMovementCard({ item, className }: SettlementMovementCardProps) {
  const isDebit = isSettlementDebit(item);
  const settlingLabel = formatSettlementDate(item.settlingAt);
  const installmentLabel = formatSettlementInstallmentLabel(item.installment);
  const statusLabel = formatSettlementMovementStatus(item.movementStatus);
  const settledLabel = formatSettlementSettledLabel(item);

  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-background p-4",
        className,
      )}
      aria-label={`Liquidação ${formatCurrency(item.netAmount)}`}
    >
      <Wallet
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          isDebit ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "font-semibold tabular-nums",
              isDebit ? "text-destructive" : "text-foreground",
            )}
          >
            {isDebit ? "−" : ""}
            {formatCurrency(item.netAmount)}
          </p>
          {isDebit ? (
            <Badge
              variant="outline"
              className="gap-1 border-destructive/30 bg-destructive/5 text-destructive"
            >
              <Undo2 className="h-3 w-3 shrink-0" aria-hidden />
              Estorno
            </Badge>
          ) : null}
          <Badge
            variant={item.movementStatus === "PAID_OUT" ? "success" : "secondary"}
            className="font-medium"
          >
            {statusLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {settlingLabel ? <span>Previsão: {settlingLabel}</span> : null}
          <span>{settledLabel}</span>
          {installmentLabel ? <span>{installmentLabel}</span> : null}
        </div>

        {item.bankAccountMask ? (
          <p className="text-xs text-muted-foreground">Conta: {item.bankAccountMask}</p>
        ) : null}
      </div>
    </article>
  );
}
