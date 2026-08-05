import type { EnrichmentStatus } from "../types/completion.types";

export type EnrichmentProcessingKind =
  | "hidden"
  | "processing"
  | "aborted"
  | "cancelled";

export type EnrichmentProcessingUi = {
  kind: EnrichmentProcessingKind;
  message: string | null;
  /** True while UI should poll for READY (not cancelled/aborted/ready). */
  shouldPoll: boolean;
};

export type DeriveEnrichmentProcessingInput = {
  enrichmentStatus: EnrichmentStatus | null | undefined;
  enrichmentReady?: boolean;
  /** service_requests.status */
  requestStatus?: string | null;
  listPhase?: string | null;
};

function isCancelled(input: DeriveEnrichmentProcessingInput): boolean {
  const requestStatus = (input.requestStatus ?? "").toUpperCase();
  const listPhase = (input.listPhase ?? "").toLowerCase();
  return requestStatus === "CANCELLED" || listPhase === "cancelled";
}

/**
 * Client-visible publication readiness projection (Req 1 / Req 7).
 * Does not invent a new service_request_status — only maps enrichment FSM + cancel.
 */
export function deriveEnrichmentProcessingUi(
  input: DeriveEnrichmentProcessingInput,
): EnrichmentProcessingUi {
  if (isCancelled(input)) {
    return {
      kind: "cancelled",
      message: "Este pedido foi cancelado. A publicação do checklist foi interrompida.",
      shouldPoll: false,
    };
  }

  if (input.enrichmentReady || input.enrichmentStatus === "READY") {
    return { kind: "hidden", message: null, shouldPoll: false };
  }

  if (input.enrichmentStatus === "ABORTED") {
    return {
      kind: "aborted",
      message: "A preparação do checklist foi interrompida para este pedido.",
      shouldPoll: false,
    };
  }

  if (
    input.enrichmentStatus === "PENDING" ||
    input.enrichmentStatus === "RUNNING"
  ) {
    return {
      kind: "processing",
      message: "Checklist de conclusão em processamento…",
      shouldPoll: true,
    };
  }

  return { kind: "hidden", message: null, shouldPoll: false };
}
