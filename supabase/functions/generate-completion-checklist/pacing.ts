/**
 * Resolve pacing / timeout budgets for generate-completion-checklist (Tasks 29/64).
 * Max concurrent LLM calls = 1 (serial); max calls per invocation capped by lease math.
 * Lease TTL SHOULD come from platform_constant enrichment_lease_ttl_seconds (dynamic).
 */

import {
  DEFAULT_MAX_LLM_PER_INVOCATION,
  ENRICHMENT_LEASE_TTL_MS,
  LLM_TIMEOUT_MARGIN_MS,
  LLM_TIMEOUT_MS,
  MAX_CONTEXT_CHARS,
} from "./constants.ts";

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Hard ceiling for LLM HTTP timeout: lease TTL minus finalize margin. */
export function maxSafeLlmTimeoutMs(
  leaseTtlMs = ENRICHMENT_LEASE_TTL_MS,
  marginMs = LLM_TIMEOUT_MARGIN_MS,
): number {
  return Math.max(5_000, leaseTtlMs - marginMs);
}

export function resolveLlmTimeoutMs(
  env: { get(key: string): string | undefined } = Deno.env,
  leaseTtlMs = ENRICHMENT_LEASE_TTL_MS,
): number {
  const fromEnv = parsePositiveInt(env.get("ENRICHMENT_LLM_TIMEOUT_MS"));
  const requested = fromEnv ?? LLM_TIMEOUT_MS;
  return Math.min(requested, maxSafeLlmTimeoutMs(leaseTtlMs));
}

/**
 * Max LLM generations after claim. Excess due rows stay PENDING for next wake/cron.
 * Serial execution (concurrency = 1); count also capped so N * timeout fits under lease.
 */
export function resolveMaxLlmCallsPerInvocation(
  env: { get(key: string): string | undefined } = Deno.env,
  timeoutMs?: number,
  leaseTtlMs = ENRICHMENT_LEASE_TTL_MS,
): number {
  const resolvedTimeout = timeoutMs ?? resolveLlmTimeoutMs(env, leaseTtlMs);
  const fromEnv = parsePositiveInt(env.get("ENRICHMENT_MAX_LLM_PER_INVOCATION"));
  const requested = fromEnv ?? DEFAULT_MAX_LLM_PER_INVOCATION;
  const maxByLease = Math.max(
    1,
    Math.floor(maxSafeLlmTimeoutMs(leaseTtlMs) / Math.max(resolvedTimeout, 1)),
  );
  return Math.min(requested, maxByLease, 5);
}

export function resolveMaxContextChars(
  env: { get(key: string): string | undefined } = Deno.env,
): number {
  return parsePositiveInt(env.get("ENRICHMENT_MAX_CONTEXT_CHARS")) ?? MAX_CONTEXT_CHARS;
}

/** Effective claim batch = min(requested, max LLM calls). Chaos: backlog N ⇒ claim ≤ this. */
export function resolveClaimBatchSize(
  requested: number,
  env: { get(key: string): string | undefined } = Deno.env,
  leaseTtlMs = ENRICHMENT_LEASE_TTL_MS,
): number {
  const maxLlm = resolveMaxLlmCallsPerInvocation(env, undefined, leaseTtlMs);
  return Math.max(1, Math.min(requested, maxLlm));
}

/**
 * Simulate claim bound against a PENDING backlog (Task 64 chaos assertion helper).
 * Worker never claims more than the paced batch, regardless of backlog size.
 */
export function claimSizeAgainstBacklog(
  backlogPending: number,
  pacedBatchSize: number,
): number {
  return Math.max(0, Math.min(backlogPending, pacedBatchSize));
}
