/**
 * Service completion domain types (design §5.8 / §5.10).
 */

export type EnrichmentStatus = "PENDING" | "RUNNING" | "READY" | "ABORTED";

export type ChecklistSource = "ai" | "fallback_template";

export type CompletionEvidencePhase = "draft" | "frozen" | "absent";

export type ContractedServiceCompletionStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "EXECUTED"
  | "COMPLETED"
  | "CANCELLED";

export type CompletedBy = "client" | "system";

/** Response value keyed by criterion block id (design §5.8.2). */
export type CompletionCriterionResponse = {
  met: boolean;
  justification?: string;
  evidence_paths: string[];
};

export type CompletionResponsesMap = Record<string, CompletionCriterionResponse>;

export type ServiceCompletionCapabilities = {
  canMarkExecuted: boolean;
  canSaveDraft: boolean;
  canConfirmWithRating: boolean;
  canSubmitOptionalRating: boolean;
  showDisputeStub: boolean;
};

export type ServiceCompletionEnrichment = {
  status: EnrichmentStatus;
  source: ChecklistSource | null;
  materializedAt: string | null;
  opsAttention: boolean;
  schemaVersion: number | null;
  checklistSchema: Record<string, unknown> | null;
};

export type ServiceCompletionContracted = {
  id: string | null;
  status: ContractedServiceCompletionStatus | string | null;
  executedAt: string | null;
  completedAt: string | null;
  completedBy: CompletedBy | string | null;
  providerId?: string | null;
  clientId?: string | null;
};

export type ServiceCompletionEvidence = {
  phase: CompletionEvidencePhase;
  frozenAt: string | null;
  draftVersion: number | null;
  responses: CompletionResponsesMap | null;
  /** System auto-marked EXECUTED after schedule-end grace without provider checklist. */
  autoExecutedWithoutChecklist: boolean;
};

export type ServiceCompletionContext = {
  serviceRequestId: string;
  enrichment: ServiceCompletionEnrichment | null;
  contractedService: ServiceCompletionContracted;
  evidence: ServiceCompletionEvidence;
  capabilities: ServiceCompletionCapabilities;
};

export type GetServiceCompletionContextResult = {
  data: ServiceCompletionContext | null;
  error: string | null;
};

export type SaveEvidenceDraftInput = {
  contractedServiceId: string;
  responses: CompletionResponsesMap;
  expectedDraftVersion?: number | null;
};

export type SaveEvidenceDraftSuccess = {
  contractedServiceId: string;
  draftVersion: number;
  phase: CompletionEvidencePhase;
};

export type SaveEvidenceDraftResult = {
  data: SaveEvidenceDraftSuccess | null;
  error: string | null;
  errorCode?: string;
};

export type CreateUploadSessionInput = {
  contractedServiceId: string;
  criterionBlockId: string;
  idempotencyKey?: string | null;
};

export type CreateUploadSessionSuccess = {
  uploadSessionId: string;
  contractedServiceId: string;
  criterionBlockId: string;
  status: string;
  storageBucket: string;
  storagePrefix: string;
  maxFiles: number;
  expiresAt: string;
  idempotent: boolean;
};

export type CreateUploadSessionResult = {
  data: CreateUploadSessionSuccess | null;
  error: string | null;
  errorCode?: string;
};

export type RegisterUploadObjectInput = {
  uploadSessionId: string;
  storagePath: string;
  contentChecksum?: string | null;
  byteSize?: number | null;
};

export type RegisterUploadObjectSuccess = {
  objectId: string;
  uploadSessionId: string;
  storagePath: string;
};

export type RegisterUploadObjectResult = {
  data: RegisterUploadObjectSuccess | null;
  error: string | null;
  errorCode?: string;
};

export type UploadEvidenceFileInput = {
  contractedServiceId: string;
  criterionBlockId: string;
  file: File;
  idempotencyKey?: string | null;
};

export type UploadEvidenceFileResult = {
  path: string | null;
  error: string | null;
  errorCode?: string;
};

/** Checklist schema shape from enrichment (allowlist blocks only). */
export type CompletionChecklistSchema = {
  version?: number | string;
  blocks: Array<Record<string, unknown>>;
};
