import { Info } from "lucide-react";
import {
  formatProviderSettlementDisclosure,
  formatProviderSettlementHoldDisclosure,
  PROVIDER_SETTLEMENT_COMPLETION_NOTE,
  type ProviderSettlementHoldReason,
} from "../utils/providerSettlementDisclosure";

export type ProviderSettlementDisclosureProps = {
  capturePaidAt: string;
  /** Real Netcred settling_at when available; preferred over D+30 estimate. */
  settlingAt?: string | null;
  showCompletionNote?: boolean;
  /** When true, bank deposit estimate is withheld (refund/dispute in progress). */
  settlementOnHold?: boolean;
  holdReason?: ProviderSettlementHoldReason;
  className?: string;
};

export function ProviderSettlementDisclosure({
  capturePaidAt,
  settlingAt = null,
  showCompletionNote = false,
  settlementOnHold = false,
  holdReason = "refund",
  className,
}: ProviderSettlementDisclosureProps) {
  const disclosure = settlementOnHold
    ? formatProviderSettlementHoldDisclosure(holdReason)
    : formatProviderSettlementDisclosure(capturePaidAt, { settlingAt });

  if (!disclosure) {
    return null;
  }

  return (
    <p className={className ?? "flex items-start gap-2 text-xs text-muted-foreground"}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {disclosure}
        {!settlementOnHold && showCompletionNote
          ? ` ${PROVIDER_SETTLEMENT_COMPLETION_NOTE}`
          : null}
      </span>
    </p>
  );
}
