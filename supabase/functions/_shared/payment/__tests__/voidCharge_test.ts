import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { NetCredAdapter } from "../netcred-adapter.ts";

const TEST_GRAPHQL_URL = "https://api.netcredbrasil.com.br/graphql";

function createSupabaseStub(): SupabaseClient<Database> {
  return {
    rpc(name: string) {
      if (name === "acquire_or_refresh_netcred_token") {
        return Promise.resolve({
          data: { status: "cached", token: "jwt-token" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
    },
  } as unknown as SupabaseClient<Database>;
}

function createAdapter(fetchFn: typeof fetch): NetCredAdapter {
  return new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn,
  });
}

Deno.test("voidCharge returns success when chargeVoid has no errors", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          chargeVoid: {
            errors: [],
            charge: { id: "417417", chargeStatus: "CANCELED" },
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, true);
  assertEquals(result.error, undefined);
});

Deno.test("voidCharge returns TERMINAL for invalid chargeId without calling gateway", async () => {
  let fetchCalled = false;
  const adapter = createAdapter(async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  });

  const result = await adapter.voidCharge({ chargeId: "not-a-number" });

  assertEquals(fetchCalled, false);
  assertEquals(result.success, false);
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.message, "Invalid chargeId");
});

Deno.test("voidCharge maps terminal gateway error to TERMINAL", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          chargeVoid: {
            errors: [{
              code: "CARD_NOT_FOUND",
              message: "Charge cannot be voided",
            }],
            charge: null,
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.message, "Charge cannot be voided");
  assertEquals(result.error?.originalCode, "CARD_NOT_FOUND");
});

Deno.test("voidCharge maps non-terminal gateway error to RETRYABLE", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          chargeVoid: {
            errors: [{
              code: "TEMPORARY_UNAVAILABLE",
              message: "try again later",
            }],
            charge: null,
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
  assertEquals(result.error?.message, "try again later");
});

Deno.test("voidCharge maps top-level GraphQL errors when chargeVoid.errors is absent", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: { chargeVoid: { charge: null } },
        errors: [{ code: "REJECTED", message: "void rejected" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "REJECTED");
});

Deno.test("voidCharge maps network TypeError to RETRYABLE", async () => {
  const adapter = createAdapter(async () => {
    throw new TypeError("fetch failed");
  });

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
  assertEquals(result.error?.message, "fetch failed");
});

Deno.test("voidCharge maps AbortError to RETRYABLE", async () => {
  const adapter = createAdapter(async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  });

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
});

Deno.test("voidCharge rethrows non-network errors", async () => {
  const adapter = createAdapter(async () => {
    throw new Error("unexpected parse failure");
  });

  await assertRejects(
    () => adapter.voidCharge({ chargeId: "417417" }),
    Error,
    "unexpected parse failure",
  );
});

Deno.test("voidCharge maps HTTP 5xx to RETRYABLE via TypeError", async () => {
  const adapter = createAdapter(async () =>
    new Response("upstream error", { status: 503 })
  );

  const result = await adapter.voidCharge({ chargeId: "417417" });

  assertEquals(result.success, false);
  assertEquals(result.error?.code, "RETRYABLE");
  assertEquals(result.error?.message.includes("503"), true);
});
