/**
 * Enrichment publication-readiness banner (Task 48).
 * PENDING/RUNNING → processing; READY hides; ABORTED/cancelled → clear messaging.
 */

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichmentStatus } from "../types/completion.types";
import {
  deriveEnrichmentProcessingUi,
  type EnrichmentProcessingKind,
} from "../utils/enrichmentProcessing";

export type EnrichmentProcessingBannerProps = {
  enrichmentStatus: EnrichmentStatus | null;
  enrichmentReady?: boolean;
  requestStatus?: string | null;
  listPhase?: string | null;
  className?: string;
  compact?: boolean;
};

const KIND_CLASS: Record<Exclude<EnrichmentProcessingKind, "hidden">, string> = {
  processing: "border-border bg-muted/40 text-muted-foreground",
  aborted: "border-destructive/30 bg-destructive/5 text-destructive",
  cancelled: "border-border bg-muted/40 text-muted-foreground",
};

export function EnrichmentProcessingBanner({
  enrichmentStatus,
  enrichmentReady = false,
  requestStatus = null,
  listPhase = null,
  className,
  compact = false,
}: EnrichmentProcessingBannerProps) {
  const ui = deriveEnrichmentProcessingUi({
    enrichmentStatus,
    enrichmentReady,
    requestStatus,
    listPhase,
  });

  if (ui.kind === "hidden" || !ui.message) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3",
        compact ? "py-2 text-xs" : "py-2.5 text-sm",
        KIND_CLASS[ui.kind],
        className,
      )}
      data-testid="enrichment-processing-banner"
      data-kind={ui.kind}
      role="status"
    >
      {ui.kind === "processing" ? (
        <Loader2
          className={cn(
            "mt-0.5 shrink-0 animate-spin",
            compact ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
          aria-hidden
        />
      ) : null}
      <p className="min-w-0 leading-snug">{ui.message}</p>
    </div>
  );
}
