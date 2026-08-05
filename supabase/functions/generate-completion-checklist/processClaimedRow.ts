/**
 * Per-row enrichment orchestration (design §5.2).
 * MUST NO-OP on abort / stale generation (RPC codes).
 */

import {
  SERVICE_COMPLETION_LOG_EVENTS,
  createServiceCompletionLogger,
} from "../_shared/observability/service-completion-logger.ts";
import type {
  ClaimedEnrichmentRow,
  GenerateCompletionChecklistDeps,
  ProcessRowOutcome,
  ServiceRequestContext,
} from "./types.ts";

const log = createServiceCompletionLogger("generate-completion-checklist");

const NOOP_CODES = new Set([
  "STALE_GENERATION",
  "STALE_LEASE_OR_STATE",
  "NOT_RUNNING",
  "NOT_RUNNING_OR_STALE_LEASE",
  "ALREADY_READY",
  "ABORTED",
  "CANCELLED",
]);

function isNoopCode(code: string): boolean {
  return NOOP_CODES.has(code) || /STALE|ABORT/i.test(code);
}

function rowBase(row: ClaimedEnrichmentRow) {
  return {
    enrichment_id: row.id,
    service_request_id: row.service_request_id,
    attempt_count: row.attempt_count,
    lease_generation: row.lease_generation,
    correlation_id: row.correlation_id,
  };
}

export async function processClaimedRow(
  row: ClaimedEnrichmentRow,
  deps: GenerateCompletionChecklistDeps,
): Promise<ProcessRowOutcome> {
  const ctx = await deps.loadContext(row.service_request_id);
  if (!ctx) {
    log.error(SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_CONTEXT_MISSING, {
      ...rowBase(row),
      outcome: "ops_attention",
      error_code: "SR_CONTEXT_MISSING",
    });
    const marked = await deps.markOpsAttention({
      enrichmentId: row.id,
      leaseOwner: row.lease_owner,
      leaseGeneration: row.lease_generation,
      reasonCode: "SR_CONTEXT_MISSING",
      detail: { service_request_id: row.service_request_id },
      correlationId: row.correlation_id,
    });
    if (marked.ok) return { kind: "ops_attention" };
    if (isNoopCode(marked.code)) return { kind: "noop", reason: marked.code };
    return { kind: "error", reason: marked.code };
  }

  if (ctx.truncated) {
    log.info(SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_CONTEXT_TRUNCATED, {
      ...rowBase(row),
      original_chars: ctx.original_chars ?? null,
      truncated_chars: ctx.truncated_chars ?? null,
    });
  }

  const llm = await deps.generateChecklist(ctx);

  if (llm.ok) {
    const edgeValidation = deps.validateSchema(llm.schema);
    if (!edgeValidation.ok) {
      return await retryOrFallbackOrOps(
        row,
        ctx,
        deps,
        `EDGE_VALIDATE_${edgeValidation.reason}`,
        edgeValidation.reason,
      );
    }

    log.info(SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_FINALIZE_AI, {
      ...rowBase(row),
      model: llm.model,
      prompt_version: llm.promptVersion,
      outcome: "ready_ai",
    });

    const finalized = await deps.finalizeReady({
      enrichmentId: row.id,
      leaseOwner: row.lease_owner,
      leaseGeneration: row.lease_generation,
      schema: edgeValidation.schema,
      source: "ai",
      correlationId: row.correlation_id,
    });

    if (finalized.ok) {
      return { kind: "ready_ai" };
    }
    if (isNoopCode(finalized.code)) {
      return { kind: "noop", reason: finalized.code };
    }
    if (finalized.code === "INVALID_CHECKLIST_SCHEMA") {
      return await retryOrFallbackOrOps(
        row,
        ctx,
        deps,
        finalized.code,
        "Postgres schema validation failed",
      );
    }
    return { kind: "error", reason: finalized.code };
  }

  if (llm.retryable) {
    return await retryOrFallbackOrOps(row, ctx, deps, llm.reason, llm.reason);
  }

  return await fallbackOrOps(row, ctx, deps, llm.reason);
}

async function retryOrFallbackOrOps(
  row: ClaimedEnrichmentRow,
  ctx: ServiceRequestContext,
  deps: GenerateCompletionChecklistDeps,
  errorCode: string,
  errorMessage: string,
): Promise<ProcessRowOutcome> {
  const maxAttempts = await deps.getMaxAttempts();
  if (row.attempt_count < maxAttempts) {
    const scheduled = await deps.scheduleRetry({
      enrichmentId: row.id,
      leaseOwner: row.lease_owner,
      leaseGeneration: row.lease_generation,
      errorCode,
      errorMessage,
    });
    if (scheduled.ok) {
      log.warn("enrichment_retry_scheduled", {
        ...rowBase(row),
        outcome: "transient_llm",
        error_code: errorCode,
      });
      return { kind: "retry_scheduled" };
    }
    if (isNoopCode(scheduled.code)) {
      return { kind: "noop", reason: scheduled.code };
    }
  }

  return await fallbackOrOps(row, ctx, deps, errorCode);
}

async function fallbackOrOps(
  row: ClaimedEnrichmentRow,
  ctx: ServiceRequestContext,
  deps: GenerateCompletionChecklistDeps,
  reasonCode: string,
): Promise<ProcessRowOutcome> {
  const template = await deps.resolveFallbackTemplate(ctx.service_id, ctx.category_id);
  if (template) {
    log.info(SERVICE_COMPLETION_LOG_EVENTS.ENRICHMENT_FALLBACK, {
      ...rowBase(row),
      template_id: template.templateId,
      outcome: "fallback",
      error_code: reasonCode,
    });

    const finalized = await deps.finalizeReady({
      enrichmentId: row.id,
      leaseOwner: row.lease_owner,
      leaseGeneration: row.lease_generation,
      schema: template.schema,
      source: "fallback_template",
      correlationId: row.correlation_id,
    });
    if (finalized.ok) {
      return { kind: "ready_fallback" };
    }
    if (isNoopCode(finalized.code)) {
      return { kind: "noop", reason: finalized.code };
    }
  }

  const marked = await deps.markOpsAttention({
    enrichmentId: row.id,
    leaseOwner: row.lease_owner,
    leaseGeneration: row.lease_generation,
    reasonCode: template
      ? `FALLBACK_FINALIZE_${reasonCode}`.slice(0, 120)
      : `NO_FALLBACK_${reasonCode}`.slice(0, 120),
    detail: {
      attempt_count: row.attempt_count,
      had_template: Boolean(template),
      reason: reasonCode,
    },
    correlationId: row.correlation_id,
  });

  if (marked.ok) {
    log.error("enrichment_ops_attention", {
      ...rowBase(row),
      outcome: "ops_attention",
      error_code: reasonCode,
    });
    return { kind: "ops_attention" };
  }
  if (isNoopCode(marked.code)) {
    return { kind: "noop", reason: marked.code };
  }
  return { kind: "error", reason: marked.code };
}
