import { assertEquals } from "std/testing/asserts";
import { resolveCronChargeOutcome } from "../resolveCronChargeOutcome.ts";

Deno.test("PAID chargeCreate result maps to PAID without undoing attempt", () => {
  const resolved = resolveCronChargeOutcome(
    {
      success: true,
      transactionState: "PAID",
      chargeId: "417417",
      transactionId: "tx-1",
    },
    1,
    3,
  );

  assertEquals(resolved, { outcome: "PAID", undoAttemptIncrement: false });
});

Deno.test("IN_ANALYSIS chargeCreate result maps to IN_ANALYSIS (antifraud hold)", () => {
  // NetCred may return IN_ANALYSIS synchronously; webhook TRANSACTION_UPDATE closes the cycle.
  const resolved = resolveCronChargeOutcome(
    {
      success: true,
      transactionState: "IN_ANALYSIS",
      chargeId: "417417",
      transactionId: "tx-1",
    },
    1,
    3,
  );

  assertEquals(resolved, {
    outcome: "IN_ANALYSIS",
    undoAttemptIncrement: false,
  });
});

Deno.test("terminal REJECTED maps to FAILED_PERMANENT and undoes attempt increment", () => {
  const resolved = resolveCronChargeOutcome(
    {
      success: false,
      transactionState: "REJECTED",
      error: {
        code: "TERMINAL",
        message: "Card declined",
        originalCode: "REJECTED",
      },
    },
    1,
    3,
  );

  assertEquals(resolved, {
    outcome: "FAILED_PERMANENT",
    undoAttemptIncrement: true,
  });
});

Deno.test("retryable gateway error maps to FAILED while attempts remain", () => {
  const resolved = resolveCronChargeOutcome(
    {
      success: false,
      error: {
        code: "RETRYABLE",
        message: "INTERNAL_SERVER_ERROR",
        originalCode: "INTERNAL_SERVER_ERROR",
      },
    },
    2,
    3,
  );

  assertEquals(resolved, { outcome: "FAILED", undoAttemptIncrement: false });
});

Deno.test("retryable error at maxAttempts becomes FAILED_PERMANENT without undo", () => {
  // Attempt budget exhausted: keep the claim increment so the schedule stays permanent.
  const resolved = resolveCronChargeOutcome(
    {
      success: false,
      error: {
        code: "RETRYABLE",
        message: "timeout",
        originalCode: "NETWORK_ERROR",
      },
    },
    3,
    3,
  );

  assertEquals(resolved, {
    outcome: "FAILED_PERMANENT",
    undoAttemptIncrement: false,
  });
});

Deno.test("AUTH_FAILURE is retryable until attempts are exhausted", () => {
  const mid = resolveCronChargeOutcome(
    {
      success: false,
      error: { code: "AUTH_FAILURE", message: "token expired" },
    },
    1,
    3,
  );
  assertEquals(mid.outcome, "FAILED");

  const exhausted = resolveCronChargeOutcome(
    {
      success: false,
      error: { code: "AUTH_FAILURE", message: "token expired" },
    },
    3,
    3,
  );
  assertEquals(exhausted, {
    outcome: "FAILED_PERMANENT",
    undoAttemptIncrement: false,
  });
});
