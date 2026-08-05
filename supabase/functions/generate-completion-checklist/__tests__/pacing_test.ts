import { assertEquals } from "std/testing/asserts";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_MAX_ATTEMPTS,
  ENRICHMENT_LEASE_TTL_MS,
  PLATFORM_CLAIM_BATCH_DEFAULT,
  PLATFORM_LEASE_TTL_SECONDS_DEFAULT,
  PLATFORM_RETRY_BASE_SECONDS_DEFAULT,
} from "../constants.ts";
import {
  claimSizeAgainstBacklog,
  maxSafeLlmTimeoutMs,
  resolveClaimBatchSize,
  resolveLlmTimeoutMs,
  resolveMaxLlmCallsPerInvocation,
} from "../pacing.ts";

function envMap(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key];
    },
  };
}

Deno.test("platform default constants align with design §3.1 / Task 64", () => {
  assertEquals(PLATFORM_CLAIM_BATCH_DEFAULT, 20);
  assertEquals(PLATFORM_LEASE_TTL_SECONDS_DEFAULT, 120);
  assertEquals(PLATFORM_RETRY_BASE_SECONDS_DEFAULT, 30);
  assertEquals(DEFAULT_MAX_ATTEMPTS, 3);
  assertEquals(DEFAULT_BATCH_SIZE, 20);
  assertEquals(ENRICHMENT_LEASE_TTL_MS, 120_000);
});

Deno.test("maxSafeLlmTimeoutMs is lease minus margin", () => {
  assertEquals(maxSafeLlmTimeoutMs(120_000, 30_000), 90_000);
});

Deno.test("resolveLlmTimeoutMs caps above safe max for dynamic lease", () => {
  const timeout = resolveLlmTimeoutMs(
    envMap({ ENRICHMENT_LLM_TIMEOUT_MS: "999999" }),
    120_000,
  );
  assertEquals(timeout, maxSafeLlmTimeoutMs(120_000));
});

Deno.test("resolveMaxLlmCallsPerInvocation defaults to 1 and respects lease math", () => {
  assertEquals(resolveMaxLlmCallsPerInvocation(envMap({})), 1);
  // 90s safe / 75s timeout => 1
  assertEquals(
    resolveMaxLlmCallsPerInvocation(
      envMap({ ENRICHMENT_MAX_LLM_PER_INVOCATION: "5", ENRICHMENT_LLM_TIMEOUT_MS: "75000" }),
      75_000,
      120_000,
    ),
    1,
  );
  // 90s safe / 40s timeout => 2, env asks 5 => 2
  assertEquals(
    resolveMaxLlmCallsPerInvocation(
      envMap({ ENRICHMENT_MAX_LLM_PER_INVOCATION: "5" }),
      40_000,
      120_000,
    ),
    2,
  );
});

Deno.test("resolveClaimBatchSize never exceeds max LLM calls (platform batch 20)", () => {
  assertEquals(
    resolveClaimBatchSize(20, envMap({ ENRICHMENT_MAX_LLM_PER_INVOCATION: "1" })),
    1,
  );
  assertEquals(
    resolveClaimBatchSize(20, envMap({ ENRICHMENT_MAX_LLM_PER_INVOCATION: "5" }), 120_000),
    1, // still 1 with default 75s timeout under 90s safe budget
  );
});

Deno.test("Task 64 chaos: backlog N PENDING still claims ≤ paced batch/tick", () => {
  const paced = resolveClaimBatchSize(
    PLATFORM_CLAIM_BATCH_DEFAULT,
    envMap({ ENRICHMENT_MAX_LLM_PER_INVOCATION: "1" }),
  );
  assertEquals(paced, 1);
  assertEquals(claimSizeAgainstBacklog(100, paced), 1);
  assertEquals(claimSizeAgainstBacklog(0, paced), 0);
  assertEquals(claimSizeAgainstBacklog(5, paced), 1);

  const pacedWider = resolveClaimBatchSize(
    PLATFORM_CLAIM_BATCH_DEFAULT,
    envMap({
      ENRICHMENT_MAX_LLM_PER_INVOCATION: "5",
      ENRICHMENT_LLM_TIMEOUT_MS: "40000",
    }),
    120_000,
  );
  assertEquals(pacedWider, 2);
  assertEquals(claimSizeAgainstBacklog(100, pacedWider), 2);
});

Deno.test("LLM timeout stays under lease — prevents lease overrun (75s < 90s safe)", () => {
  const leaseMs = ENRICHMENT_LEASE_TTL_MS;
  const timeout = resolveLlmTimeoutMs(envMap({}), leaseMs);
  assertEquals(timeout <= maxSafeLlmTimeoutMs(leaseMs), true);
  assertEquals(timeout, 75_000);
});
