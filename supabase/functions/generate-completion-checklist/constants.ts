/**
 * Enrichment worker pacing / timeout / truncation constants (Tasks 29/64, design §6.2–6.3 / §9.4).
 *
 * Platform defaults (DB `platform_constants`, read dynamically at runtime):
 * - enrichment_claim_batch_size = 20
 * - enrichment_lease_ttl_seconds = 120
 * - enrichment_retry_base_seconds = 30 (RPC-only)
 * - checklist_ai_max_attempts = 3
 *
 * Env overrides (Edge secrets / local):
 * - ENRICHMENT_MAX_LLM_PER_INVOCATION — max LLM calls after claim (default 1; capped by lease math)
 * - ENRICHMENT_LLM_TIMEOUT_MS — Gemini HTTP timeout (default 75000; hard-capped under lease)
 * - ENRICHMENT_MAX_CONTEXT_CHARS — intake truncation budget (default 12000)
 * - GEMINI_API_KEY — required for AI path (same secret as generate-smart-description)
 * - GEMINI_CHECKLIST_MODEL — optional model override (default: gemini-2.5-flash-lite)
 *
 * See PACING.md in this folder.
 */

export const FUNCTION_NAME = "generate-completion-checklist";

/** Mirrors platform_constant enrichment_claim_batch_size (fallback if RPC fails). */
export const PLATFORM_CLAIM_BATCH_DEFAULT = 20;

/** Mirrors platform_constant enrichment_lease_ttl_seconds. */
export const PLATFORM_LEASE_TTL_SECONDS_DEFAULT = 120;

/** Aligns with platform_constant enrichment_lease_ttl_seconds (120). */
export const ENRICHMENT_LEASE_TTL_MS = PLATFORM_LEASE_TTL_SECONDS_DEFAULT * 1_000;

/** Wall-clock margin kept under lease for finalize/retry RPCs after LLM. */
export const LLM_TIMEOUT_MARGIN_MS = 30_000;

/**
 * Fallback claim size when platform_constant read fails.
 * Effective claim is still capped by resolveClaimBatchSize (LLM pacing).
 */
export const DEFAULT_BATCH_SIZE = PLATFORM_CLAIM_BATCH_DEFAULT;

/** Default max LLM calls per Edge invocation (serial). Excess stay PENDING unclaimed. */
export const DEFAULT_MAX_LLM_PER_INVOCATION = 1;

/** Max UTF-8 chars of context sent to the LLM (truncate + log beyond). */
export const MAX_CONTEXT_CHARS = 12_000;

/** Default LLM HTTP budget — must stay well below lease TTL with margin. */
export const LLM_TIMEOUT_MS = 75_000;

/** Mirrors platform_constant checklist_ai_max_attempts. */
export const DEFAULT_MAX_ATTEMPTS = 3;

/** Mirrors platform_constant enrichment_retry_base_seconds (used by RPC, not Edge). */
export const PLATFORM_RETRY_BASE_SECONDS_DEFAULT = 30;

export const DEFAULT_CRITERION_MIN = 3;
export const DEFAULT_CRITERION_MAX = 12;
export const DEFAULT_EVIDENCE_MIN = 1;
export const DEFAULT_EVIDENCE_MAX = 5;

export const ALLOWED_BLOCK_TYPES = ["completion_criterion", "static_text"] as const;

export const SYSTEM_PROMPT = `You generate a service-completion checklist JSON for a Brazilian home-services marketplace.
Return ONLY a JSON object with this shape (ADR-0003):
{
  "version": 1,
  "blocks": [
    {
      "id": "crit_unique_snake",
      "type": "completion_criterion",
      "label": "Pergunta curta em pt-BR?",
      "required": true,
      "config": {
        "requires_evidence_when_met": true|false,
        "evidence_min": 1,
        "evidence_max": 5
      },
      "helpText": "opcional"
    },
    {
      "id": "static_hint",
      "type": "static_text",
      "content": "Texto de orientação em pt-BR."
    }
  ]
}
Hard rules:
- version MUST be 1
- blocks MUST be an array
- Exactly 3 to 12 blocks of type "completion_criterion" (static_text does not count toward that range but is allowed)
- Block types allowlisted: completion_criterion | static_text ONLY
- Do NOT include top-level "evidence_images"
- Each completion_criterion needs unique id, non-empty label, required boolean, and config.requires_evidence_when_met boolean
- evidence_min >= 1; evidence_max >= evidence_min; evidence_max <= 5
- Prefer criteria about: trabalho executado, limpeza/organização, acesso/horários, materiais/garantia when relevant
- Labels and static_text content in Portuguese (Brazil)
- Match criteria to the service request context`;
