/** Types for generate-completion-checklist worker (design §5.2 / §5.3.2). */

export type ClaimedEnrichmentRow = {
  id: string;
  service_request_id: string;
  attempt_count: number;
  lease_owner: string;
  lease_generation: number;
  locked_until: string | null;
  correlation_id: string | null;
};

export type ServiceRequestContext = {
  service_request_id: string;
  /** Kept for fallback template resolution — not sent to the LLM. */
  service_id: string | null;
  /** Kept for fallback template resolution — not sent to the LLM. */
  category_id: string | null;
  /** Human-readable catalog label for the LLM prompt. */
  service_title: string | null;
  /** Human-readable parent category label for the LLM prompt. */
  category_title: string | null;
  title: string | null;
  description: string | null;
  form_data: Record<string, unknown> | null;
  truncated: boolean;
  original_chars?: number;
  truncated_chars?: number;
};

export type CompletionCriterionBlock = {
  id: string;
  type: "completion_criterion";
  label: string;
  required: boolean;
  config: {
    requires_evidence_when_met: boolean;
    evidence_min: number;
    evidence_max: number;
  };
  helpText?: string;
};

export type StaticTextBlock = {
  id?: string;
  type: "static_text";
  content: string;
};

export type ChecklistBlock = CompletionCriterionBlock | StaticTextBlock;

export type ChecklistSchema = {
  version: number;
  blocks: ChecklistBlock[];
};

export type LlmGenerateResult =
  | { ok: true; schema: ChecklistSchema; model: string; promptVersion: string | null }
  | {
    ok: false;
    reason: string;
    retryable: boolean;
    errorClass: "transient" | "validation" | "fatal";
  };

export type ProcessRowOutcome =
  | { kind: "ready_ai" }
  | { kind: "ready_fallback" }
  | { kind: "retry_scheduled" }
  | { kind: "ops_attention" }
  | { kind: "noop"; reason: string }
  | { kind: "error"; reason: string };

export type WorkerRunSummary = {
  claimed: number;
  ready_ai: number;
  ready_fallback: number;
  retry_scheduled: number;
  ops_attention: number;
  noop: number;
  errors: number;
};

export type GenerateCompletionChecklistDeps = {
  claimBatch: (leaseOwner: string, batchSize: number) => Promise<ClaimedEnrichmentRow[]>;
  loadContext: (serviceRequestId: string) => Promise<ServiceRequestContext | null>;
  generateChecklist: (ctx: ServiceRequestContext) => Promise<LlmGenerateResult>;
  validateSchema: (
    schema: unknown,
  ) => { ok: true; schema: ChecklistSchema } | { ok: false; reason: string };
  finalizeReady: (input: {
    enrichmentId: string;
    leaseOwner: string;
    leaseGeneration: number;
    schema: ChecklistSchema;
    source: "ai" | "fallback_template";
    correlationId: string | null;
  }) => Promise<{ ok: true } | { ok: false; code: string }>;
  scheduleRetry: (input: {
    enrichmentId: string;
    leaseOwner: string;
    leaseGeneration: number;
    errorCode: string;
    errorMessage: string | null;
  }) => Promise<{ ok: true; nextAttemptAt: string | null } | { ok: false; code: string }>;
  resolveFallbackTemplate: (
    serviceId: string | null,
    categoryId: string | null,
  ) => Promise<{ templateId: string; schema: ChecklistSchema } | null>;
  markOpsAttention: (input: {
    enrichmentId: string;
    leaseOwner: string;
    leaseGeneration: number;
    reasonCode: string;
    detail: Record<string, unknown> | null;
    correlationId: string | null;
  }) => Promise<{ ok: true } | { ok: false; code: string }>;
  getMaxAttempts: () => Promise<number>;
  /** Dynamic platform_constant enrichment_claim_batch_size (default 20). */
  getClaimBatchSizeDefault: () => Promise<number>;
  /** Dynamic platform_constant enrichment_lease_ttl_seconds (default 120). */
  getLeaseTtlSeconds: () => Promise<number>;
  createLeaseOwner: () => string;
  /** Sync fallback when getters are stubbed in unit tests. */
  batchSize: number;
};
