import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { ProviderAuthError } from "../errors.ts";
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

Deno.test("getTransaction returns mapped transaction when node is present", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          transactions: {
            edges: [{
              node: {
                id: "tx-1",
                transactionState: "PAID",
                amount: "1000.00",
                paidAmount: "1000.00",
                charge: {
                  id: "417417",
                  referenceCode: "ref-abc",
                },
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.getTransaction({
    referenceCode: "ref-abc",
    companyId: "1048",
  });

  assertEquals(result, {
    transactionId: "tx-1",
    chargeId: "417417",
    referenceCode: "ref-abc",
    transactionState: "PAID",
    paidAmount: "1000.00",
    refundedAmount: undefined,
    rejectedReason: null,
  });
});

Deno.test("getTransaction falls back to amount when paidAmount is missing", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          transactions: {
            edges: [{
              node: {
                id: "tx-2",
                transactionState: "IN_ANALYSIS",
                amount: "500.00",
                charge: { id: "1", referenceCode: null },
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.getTransaction({
    referenceCode: "fallback-ref",
    companyId: "1048",
  });

  assertEquals(result?.paidAmount, "500.00");
  assertEquals(result?.referenceCode, "fallback-ref");
});

Deno.test("getTransaction returns null when node lacks id or transactionState", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          transactions: {
            edges: [{
              node: {
                id: null,
                transactionState: "PAID",
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.getTransaction({
    referenceCode: "ref",
    companyId: "1048",
  });

  assertEquals(result, null);
});

Deno.test("getTransaction throws when companyId is missing or non-numeric", async () => {
  const adapter = createAdapter(async () => new Response("{}", { status: 200 }));

  await assertRejects(
    () => adapter.getTransaction({ referenceCode: "ref" }),
    Error,
    "GET_TRANSACTION_COMPANY_ID_REQUIRED",
  );

  await assertRejects(
    () => adapter.getTransaction({ referenceCode: "ref", companyId: "abc" }),
    Error,
    "GET_TRANSACTION_COMPANY_ID_REQUIRED",
  );
});

Deno.test("getTransaction rethrows network errors", async () => {
  const adapter = createAdapter(async () => {
    throw new TypeError("connection reset");
  });

  await assertRejects(
    () =>
      adapter.getTransaction({
        referenceCode: "ref",
        companyId: "1048",
      }),
    TypeError,
    "connection reset",
  );
});

Deno.test("getTransaction rethrows ProviderAuthError after failed auth retry", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        errors: [{ code: "UNAUTHENTICATED", message: "Unauthorized" }],
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  );

  await assertRejects(
    () =>
      adapter.getTransaction({
        referenceCode: "ref",
        companyId: "1048",
      }),
    ProviderAuthError,
    "NETCRED_AUTH_FAILURE",
  );
});

Deno.test("getTransaction returns null for unexpected non-network errors", async () => {
  const adapter = createAdapter(async () => {
    throw new Error("malformed json path");
  });

  const result = await adapter.getTransaction({
    referenceCode: "ref",
    companyId: "1048",
  });

  assertEquals(result, null);
});
