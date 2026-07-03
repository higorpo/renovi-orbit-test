import { Info } from "lucide-react";
import { formatProviderSettlementDisclosure, PROVIDER_SETTLEMENT_COMPLETION_NOTE } from "../utils/providerSettlementDisclosure";

export type ProviderSettlementDisclosureProps = {
  capturePaidAt: string;
  showCompletionNote?: boolean;
  className?: string;
};

export function ProviderSettlementDisclosure({
  capturePaidAt,
  showCompletionNote = false,
  className,
}: ProviderSettlementDisclosureProps) {
  const disclosure = formatProviderSettlementDisclosure(capturePaidAt);
  if (!disclosure) {
    return null;
  }

  return (
    <p className={className ?? "flex items-start gap-2 text-xs text-muted-foreground"}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {disclosure}
        {showCompletionNote ? ` ${PROVIDER_SETTLEMENT_COMPLETION_NOTE}` : null}
      </span>
    </p>
  );
}
