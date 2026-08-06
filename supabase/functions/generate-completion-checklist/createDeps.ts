/**
 * Wire Supabase RPCs + Gemini into worker deps (design §5.2).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../_shared/database.types.ts";
import {
  SERVICE_COMPLETION_LOG_EVENTS,
  createServiceCompletionLogger,
} from "../_shared/observability/service-completion-logger.ts";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_ATTEMPTS,
  FUNCTION_NAME,
  PLATFORM_LEASE_TTL_SECONDS_DEFAULT,
} from "./constants.ts";
import { buildServiceRequestContext } from "./loadContext.ts";
import { generateChecklistWithGemini } from "./llmGenerate.ts";
import { resolveLlmTimeoutMs, resolveMaxContextChars } from "./pacing.ts";
import { validateChecklistSchema } from "./validateSchema.ts";
import type {
  ChecklistSchema,
  ClaimedEnrichmentRow,
  GenerateCompletionChecklistDeps,
} from "./types.ts";

const log = createServiceCompletionLogger(FUNCTION_NAME);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseClaimedRows(data: unknown): ClaimedEnrichmentRow[] {
  if (!Array.isArray(data)) return [];
  const rows: ClaimedEnrichmentRow[] = [];
  for (const entry of data) {
    const row = asRecord(entry);
    if (!row) continue;
    const id = String(row.id ?? "");
    const serviceRequestId = String(row.service_request_id ?? "");
    if (!id || !serviceRequestId) continue;
    rows.push({
      id,
      service_request_id: serviceRequestId,
      attempt_count: Number(row.attempt_count ?? 0),
      lease_owner: String(row.lease_owner ?? ""),
      lease_generation: Number(row.lease_generation ?? 0),
      locked_until: row.locked_until == null ? null : String(row.locked_until),
      correlation_id: row.correlation_id == null ? null : String(row.correlation_id),
    });
  }
  return rows;
}

function rpcFailureCode(error: { message?: string } | null, fallback: string): string {
  const message = error?.message ?? "";
  if (/INVALID_CHECKLIST_SCHEMA/i.test(message)) {
    return "INVALID_CHECKLIST_SCHEMA";
  }
  return fallback;
}

export function createGenerateCompletionChecklistDeps(
  supabase: SupabaseClient<Database>,
): GenerateCompletionChecklistDeps {
  const getLeaseTtlSeconds = async () => {
    const { data, error } = await supabase.rpc("platform_constant_int", {
      p_key: "enrichment_lease_ttl_seconds",
      p_default: PLATFORM_LEASE_TTL_SECONDS_DEFAULT,
    });
    if (error || typeof data !== "number" || data <= 0) {
      return PLATFORM_LEASE_TTL_SECONDS_DEFAULT;
    }
    return data;
  };

  const getClaimBatchSizeDefault = async () => {
    const { data, error } = await supabase.rpc("platform_constant_int", {
      p_key: "enrichment_claim_batch_size",
      p_default: DEFAULT_BATCH_SIZE,
    });
    if (error || typeof data !== "number" || data <= 0) {
      return DEFAULT_BATCH_SIZE;
    }
    return data;
  };

  return {
    batchSize: DEFAULT_BATCH_SIZE,
    createLeaseOwner: () => `${FUNCTION_NAME}:${crypto.randomUUID()}`,
    validateSchema: validateChecklistSchema,
    getLeaseTtlSeconds,
    getClaimBatchSizeDefault,
    getMaxAttempts: async () => {
      const { data, error } = await supabase.rpc("platform_constant_int", {
        p_key: "checklist_ai_max_attempts",
        p_default: DEFAULT_MAX_ATTEMPTS,
      });
      if (error || typeof data !== "number") {
        return DEFAULT_MAX_ATTEMPTS;
      }
      return data;
    },
    claimBatch: async (leaseOwner, batchSize) => {
      const { data, error } = await supabase.rpc("enrichment_claim_batch", {
        p_lease_owner: leaseOwner,
        p_batch_size: batchSize,
      });
      if (error) {
        throw new Error(`enrichment_claim_batch: ${error.message}`);
      }
      return parseClaimedRows(data);
    },
    loadContext: async (serviceRequestId) => {
      const { data, error } = await supabase
        .from("service_requests")
        .select("id, service_id, title, description, form_data")
        .eq("id", serviceRequestId)
        .maybeSingle();

      if (error || !data) {
        log.error(SERVICE_COMPLETION_LOG_EVENTS.LOAD_CONTEXT_FAILED, {
          service_request_id: serviceRequestId,
          outcome: "ops_attention",
          error_code: error?.message ?? "not_found",
        });
        return null;
      }

      let categoryId: string | null = null;
      let serviceTitle: string | null = null;
      let categoryTitle: string | null = null;

      if (data.service_id) {
        const { data: serviceRow } = await supabase
          .from("platform_services")
          .select("parent_id, title")
          .eq("id", data.service_id)
          .maybeSingle();
        serviceTitle = serviceRow?.title ?? null;
        categoryId = serviceRow?.parent_id ?? null;

        if (categoryId) {
          const { data: categoryRow } = await supabase
            .from("platform_services")
            .select("title")
            .eq("id", categoryId)
            .maybeSingle();
          categoryTitle = categoryRow?.title ?? null;
        }
      }

      return buildServiceRequestContext(
        {
          id: data.id,
          service_id: data.service_id,
          title: data.title,
          description: data.description,
          form_data: data.form_data,
        },
        {
          categoryId,
          serviceTitle,
          categoryTitle,
        },
        resolveMaxContextChars(),
      );
    },
    generateChecklist: async (ctx) => {
      const leaseTtlMs = (await getLeaseTtlSeconds()) * 1_000;
      return generateChecklistWithGemini(ctx, {
        apiKey: Deno.env.get("GEMINI_API_KEY"),
        timeoutMs: resolveLlmTimeoutMs(Deno.env, leaseTtlMs),
      });
    },
    finalizeReady: async (input) => {
      const { data, error } = await supabase.rpc("enrichment_finalize_ready", {
        p_enrichment_id: input.enrichmentId,
        p_lease_owner: input.leaseOwner,
        p_lease_generation: input.leaseGeneration,
        p_schema: input.schema as unknown as Json,
        p_source: input.source,
        p_correlation_id: input.correlationId ?? undefined,
      });

      if (error) {
        return { ok: false, code: rpcFailureCode(error, error.message) };
      }

      const result = asRecord(data);
      if (result?.ok === true) {
        return { ok: true };
      }
      return {
        ok: false,
        code: String(result?.reason ?? "FINALIZE_FAILED"),
      };
    },
    scheduleRetry: async (input) => {
      const { data, error } = await supabase.rpc("enrichment_schedule_retry", {
        p_enrichment_id: input.enrichmentId,
        p_lease_owner: input.leaseOwner,
        p_lease_generation: input.leaseGeneration,
        p_error_code: input.errorCode.slice(0, 120),
        p_error_message: input.errorMessage?.slice(0, 500) ?? undefined,
      });

      if (error) {
        return { ok: false, code: error.message };
      }

      const result = asRecord(data);
      if (result?.ok === true) {
        return {
          ok: true,
          nextAttemptAt: result.next_attempt_at == null
            ? null
            : String(result.next_attempt_at),
        };
      }
      return {
        ok: false,
        code: String(result?.reason ?? "RETRY_FAILED"),
      };
    },
    resolveFallbackTemplate: async (serviceId, categoryId) => {
      // SQL accepts null platform service (global cascade); generated Args mark it required.
      const { data, error } = await supabase.rpc(
        "resolve_completion_checklist_template",
        {
          p_platform_service_id: serviceId as string,
          p_category_id: categoryId ?? undefined,
        },
      );

      if (error || data == null) {
        return null;
      }

      const result = asRecord(data);
      if (!result) return null;

      const schemaRaw = result.checklist_schema;
      const validated = validateChecklistSchema(schemaRaw);
      if (!validated.ok) {
        log.error(SERVICE_COMPLETION_LOG_EVENTS.FALLBACK_TEMPLATE_INVALID, {
          template_id: result.template_id,
          error_code: validated.reason,
          outcome: "validation",
          platform_service_id: serviceId,
          category_id: categoryId,
        });
        return null;
      }

      return {
        templateId: String(result.template_id),
        schema: validated.schema,
      };
    },
    markOpsAttention: async (input) => {
      const { data, error } = await supabase.rpc("enrichment_mark_ops_attention", {
        p_enrichment_id: input.enrichmentId,
        p_reason: input.reasonCode.slice(0, 200),
        p_lease_owner: input.leaseOwner,
        p_lease_generation: input.leaseGeneration,
        p_correlation_id: input.correlationId ?? undefined,
        p_payload: (input.detail ?? {}) as Json,
      });

      if (error) {
        return { ok: false, code: error.message };
      }

      const result = asRecord(data);
      if (result?.ok === true) {
        return { ok: true };
      }
      return {
        ok: false,
        code: String(result?.reason ?? "OPS_ATTENTION_FAILED"),
      };
    },
  };
}

export type { ChecklistSchema };
